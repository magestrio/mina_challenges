import { TestingAppChain } from "@proto-kit/sdk";
import { Field, Poseidon, PrivateKey, UInt32, UInt64 } from "o1js";
import { MessageModule } from "../src/message";
import { log } from "@proto-kit/common";
import { Message, MessageAppStateOutput, createMessage } from "../src/common";
import { MessageProgram, MessageProof } from "../src/message_proof";
import exp from "constants";

log.setLevel("ERROR");

describe("Messages", () => {
  let appChain = TestingAppChain.fromRuntime({
    MessageModule,
  });

  let module: MessageModule;

  appChain.configurePartial({
    Runtime: {
      MessageModule: {},
      Balances: {},
    },
  });

  const alicePrivateKey = PrivateKey.random();
  const alice = alicePrivateKey.toPublicKey();

  beforeAll(async () => {
    MessageProgram.analyzeMethods();
    await MessageProgram.compile();
  }, 1_000_000);

  beforeEach(async () => {
    await appChain.start();
    appChain.setSigner(alicePrivateKey);
    module = appChain.runtime.resolve("MessageModule");
  });

  async function register(appState: MessageAppStateOutput) {
    const tx = await appChain.transaction(alice, () => {
      module.register(appState);
    });

    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();

    expect(block?.transactions[0].status.toBoolean()).toBe(true);
  }

  describe("successful cases", () => {
    test("should proceed a single message from one agent", async () => {
      const agentId = UInt64.from(1);

      const state = new MessageAppStateOutput({
        agentId,
        lastMessageNumber: UInt32.from(0),
        securityCodeHash: Poseidon.hash(Field(4).toFields()),
      });

      await register(state);

      const message = new Message({
        agentId,
        number: UInt32.from(1),
        characters: createMessage("123456789123"),
        securityCode: Field(4),
      });

      const rootState =
        await appChain.query.runtime.MessageModule.currentState.get(agentId);

      const proof: MessageProof = await MessageProgram.message(
        rootState!,
        message
      );

      const tx = await appChain.transaction(alice, () => {
        module.sendMessage(proof);
      });

      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();

      const agent1State =
        await appChain.query.runtime.MessageModule.currentState.get(agentId);
      expect(block?.transactions[0].status.toBoolean()).toBe(true);

      expect(agent1State).toBeDefined();
      expect(agent1State?.lastMessageNumber).toEqual(UInt32.from(1));
    }, 1_000_000);
  });

  describe("failed cases", () => {
    test("agent state and message are different", async () => {
      const agentId = UInt64.from(1);

      const state = new MessageAppStateOutput({
        agentId,
        lastMessageNumber: UInt32.from(0),
        securityCodeHash: Poseidon.hash(Field(4).toFields()),
      });

      await register(state);

      const message = new Message({
        agentId: UInt64.from(2),
        number: UInt32.from(1),
        characters: createMessage("123456789123"),
        securityCode: Field(4),
      });

      const rootState =
        await appChain.query.runtime.MessageModule.currentState.get(agentId);

      expect(async () => {
        await MessageProgram.message(rootState!, message);
      }).rejects;
    });

    test("security code does not match", async () => {
      const agentId = UInt64.from(1);

      const state = new MessageAppStateOutput({
        agentId,
        lastMessageNumber: UInt32.from(0),
        securityCodeHash: Poseidon.hash(Field(4).toFields()),
      });

      await register(state);

      const message = new Message({
        agentId: UInt64.from(2),
        number: UInt32.from(1),
        characters: createMessage("123456789123"),
        securityCode: Field(6),
      });

      const rootState =
        await appChain.query.runtime.MessageModule.currentState.get(agentId);

      expect(async () => {
        await MessageProgram.message(rootState!, message);
      }).rejects;
    });

    test("message is of the wrong length", async () => {
      const agentId = UInt64.from(1);

      const state = new MessageAppStateOutput({
        agentId,
        lastMessageNumber: UInt32.from(0),
        securityCodeHash: Poseidon.hash(Field(4).toFields()),
      });

      await register(state);

      const message = new Message({
        agentId: UInt64.from(2),
        number: UInt32.from(1),
        characters: createMessage("1234567893"),
        securityCode: Field(6),
      });

      const rootState =
        await appChain.query.runtime.MessageModule.currentState.get(agentId);

      expect(async () => {
        await MessageProgram.message(rootState!, message);
      }).rejects;
    });

    test("message number is lower than the previous", async () => {
      const agentId = UInt64.from(1);

      const state = new MessageAppStateOutput({
        agentId,
        lastMessageNumber: UInt32.from(2),
        securityCodeHash: Poseidon.hash(Field(4).toFields()),
      });

      await register(state);

      const message = new Message({
        agentId: UInt64.from(2),
        number: UInt32.from(1),
        characters: createMessage("123456789123"),
        securityCode: Field(6),
      });

      const rootState =
        await appChain.query.runtime.MessageModule.currentState.get(agentId);

      expect(async () => {
        await MessageProgram.message(rootState!, message);
      }).rejects;
    });
  });
});
