import {
  Field,
  SelfProof,
  MerkleWitness,
  Poseidon,
  Experimental,
  Provable
} from 'o1js';

import {
  MessageAppState,
  Message,
  CHARACTER_LENGTH,
  MessageAppStateOutput,
} from "./common.js";

export const MessageProgram = Experimental.ZkProgram({
  name: "message",
  publicInput: MessageAppState,
  publicOutput: MessageAppStateOutput,

  methods: {
    message: {
      privateInputs: [Message],

      method(state: MessageAppState, message: Message): MessageAppStateOutput {
        state.agentId.assertEquals(message.agentId);
        const messageSecurityCodeHash = Poseidon.hash(
          message.securityCode.toFields()
        );
        state.securityCodeHash.assertEquals(messageSecurityCodeHash);
        
        for (let i = 0; i < CHARACTER_LENGTH; i++) {
          message.characters[i].isNull().assertFalse();
        }
        
        message.number.assertGreaterThan(state.lastMessageNumber);

        return new MessageAppStateOutput({
          agentId: state.agentId,
          lastMessageNumber: message.number,
          securityCodeHash: Field(0),
        });
      },
    },
  },
});

export class MessageProof extends Experimental.ZkProgram.Proof(MessageProgram) {}
