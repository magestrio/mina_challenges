import { RuntimeModule, runtimeMethod, state } from "@proto-kit/module";
import { CurrentBlock, StateMap, assert } from "@proto-kit/protocol";
import {
  Character,
  CircuitString,
  Field,
  Provable,
  Struct,
  UInt32,
  UInt64,
} from "o1js";
import { MessageAppState, MessageAppStateOutput } from "./common";
import { MessageProgram, MessageProof } from "./message_proof";
import { decrypt } from "o1js/dist/node/lib/encryption";

export class MessageModule extends RuntimeModule<Record<string, never>> {
  @state() public currentState = StateMap.from<UInt64, MessageAppState>(
    UInt64,
    MessageAppState
  );

  @runtimeMethod()
  public register(state: MessageAppStateOutput) {
    this.currentState.set(
      state.agentId,
      new MessageAppState({
        agentId: state.agentId,
        blockHeight: this.network.block.height,
        nonce: this.transaction.nonce.value,
        lastMessageNumber: state.lastMessageNumber,
        securityCodeHash: state.securityCodeHash,
        sender: this.transaction.sender.value,
      })
    );
  }

  @runtimeMethod()
  public sendMessage(proof: MessageProof) {
    const agentId = proof.publicInput.agentId;
    assert(this.currentState.get(agentId).isSome.equals(true));

    const agentState = this.currentState.get(agentId).value;
    
    this.currentState.set(
      proof.publicOutput.agentId,
      new MessageAppState({
        agentId,
        blockHeight: this.network.block.height,
        nonce: this.transaction.nonce.value,
        lastMessageNumber: proof.publicOutput.lastMessageNumber,
        securityCodeHash: agentState.securityCodeHash,
        sender: this.transaction.sender.value,
      })
    );
  }
}
