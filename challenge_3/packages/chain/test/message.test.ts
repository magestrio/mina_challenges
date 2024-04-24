import { TestingAppChain } from "@proto-kit/sdk";
import {
  Character,
  Circuit,
  CircuitString,
  Field,
  PrivateKey,
  Provable,
  UInt32,
  UInt64,
} from "o1js";
import { Agent, Message, MessageModule, createMessage } from "../src/message";
import { log } from "@proto-kit/common";
import { BalancesKey, TokenId } from "@proto-kit/library";
import { exec } from "child_process";

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

  beforeEach(async () => {
    await appChain.start();
    appChain.setSigner(alicePrivateKey);
    module = appChain.runtime.resolve("MessageModule");
  });

  async function addAgent(id: UInt64, agent: Agent) {
    const tx = await appChain.transaction(alice, () => {
      module.addAgent(id, agent);
    });

    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();

    expect(block?.transactions[0].status.toBoolean()).toBe(true);

    const state =
      await appChain.query.runtime.MessageModule.currentState.get(id);

    expect(state).toEqual(agent);
  }

  describe("successful cases", () => {
    test("should proceed a single message from one agent", async () => {
      const agentId = UInt64.from(1);
      const agent = new Agent({
        lastMessageNumber: UInt32.from(0),
        securityCode: Field(4),
      });

      await addAgent(agentId, agent);

      const message = new Message({
        agentId,
        number: UInt32.from(1),
        characters: createMessage("123456789123"),
        securityCode: Field(4),
      });

      const tx = await appChain.transaction(alice, () => {
        module.sendMessage(message);
      });

      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();

      const state =
        await appChain.query.runtime.MessageModule.currentState.get(agentId);
      expect(block?.transactions[0].status.toBoolean()).toBe(true);

      expect(state).toBeDefined();
      expect(state?.lastMessageNumber).toEqual(UInt32.from(1));
    });
    test("should proceed multiple messages from one agent", async () => {
      const agentId = UInt64.from(1);
      const agent = new Agent({
        lastMessageNumber: UInt32.from(0),
        securityCode: Field(4),
      });

      await addAgent(agentId, agent);

      const message1 = new Message({
        agentId,
        number: UInt32.from(1),
        characters: createMessage("123456789123"),
        securityCode: Field(4),
      });

      const tx = await appChain.transaction(alice, () => {
        module.sendMessage(message1);
      });

      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();

      const message2 = new Message({
        agentId,
        number: UInt32.from(2),
        characters: createMessage("123456789123"),
        securityCode: Field(4),
      });

      const tx2 = await appChain.transaction(alice, () => {
        module.sendMessage(message2);
      });

      await tx2.sign();
      await tx2.send();

      const block2 = await appChain.produceBlock();

      const state =
        await appChain.query.runtime.MessageModule.currentState.get(agentId);
      expect(block?.transactions[0].status.toBoolean()).toBe(true);
      expect(block2?.transactions[0].status.toBoolean()).toBe(true);

      expect(state).toBeDefined();
      expect(state?.lastMessageNumber).toEqual(UInt32.from(2));
    });
    test("should proceed one message from multiple agents", async () => {
      // Add agent 1
      const agentId = UInt64.from(1);
      const agent = new Agent({
        lastMessageNumber: UInt32.from(0),
        securityCode: Field(4),
      });
      await addAgent(agentId, agent);

      // Add agent 2
      const agentId2 = UInt64.from(2);
      const agent2 = new Agent({
        lastMessageNumber: UInt32.from(0),
        securityCode: Field(5),
      });
      await addAgent(agentId2, agent2);

      const message1 = new Message({
        agentId,
        number: UInt32.from(1),
        characters: createMessage("123456789123"),
        securityCode: Field(4),
      });

      const tx = await appChain.transaction(alice, () => {
        module.sendMessage(message1);
      });

      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();

      const message2 = new Message({
        agentId: agentId2,
        number: UInt32.from(2),
        characters: createMessage("1234gh789123"),
        securityCode: Field(5),
      });

      const tx2 = await appChain.transaction(alice, () => {
        module.sendMessage(message2);
      });

      await tx2.sign();
      await tx2.send();

      const block2 = await appChain.produceBlock();

      const agent1State =
        await appChain.query.runtime.MessageModule.currentState.get(agentId);

      const agent2State =
        await appChain.query.runtime.MessageModule.currentState.get(agentId2);

      expect(block?.transactions[0].status.toBoolean()).toBe(true);
      expect(block2?.transactions[0].status.toBoolean()).toBe(true);

      expect(agent1State).toBeDefined();
      expect(agent1State?.lastMessageNumber).toEqual(UInt32.from(1));

      expect(agent2State).toBeDefined();
      expect(agent2State?.lastMessageNumber).toEqual(UInt32.from(2));
    });
  });

  describe("failed cases", () => {
    test("agent does not exist in the system", async () => {
      const agentId = UInt64.from(1);
      const agent = new Agent({
        lastMessageNumber: UInt32.from(0),
        securityCode: Field(4),
      });

      const message = new Message({
        agentId,
        number: UInt32.from(1),
        characters: createMessage("123456789123"),
        securityCode: Field(4),
      });

      const tx = await appChain.transaction(alice, () => {
        module.sendMessage(message);
      });

      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();

      expect(block?.transactions[0].status.toBoolean()).toBe(false);
      expect(block?.transactions[0].statusMessage).toBe(
        "agent does not exist in the system"
      );
    });
    test("security code does not match", async () => {
      const agentId = UInt64.from(1);
      const agent = new Agent({
        lastMessageNumber: UInt32.from(0),
        securityCode: Field(3),
      });

      await addAgent(agentId, agent);

      const message = new Message({
        agentId,
        number: UInt32.from(1),
        characters: createMessage("123456789123"),
        securityCode: Field(4),
      });

      const tx = await appChain.transaction(alice, () => {
        module.sendMessage(message);
      });

      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();

      expect(block?.transactions[0].status.toBoolean()).toBe(false);
      expect(block?.transactions[0].statusMessage).toBe(
        "security code does not match"
      );
    });
    test("message is of the wrong length", async () => {
      const agentId = UInt64.from(1);
      const agent = new Agent({
        lastMessageNumber: UInt32.from(2),
        securityCode: Field(4),
      });

      await addAgent(agentId, agent);

      const message = new Message({
        agentId,
        number: UInt32.from(1),
        characters: createMessage("12345678912"),
        securityCode: Field(4),
      });

      const tx = await appChain.transaction(alice, () => {
        module.sendMessage(message);
      });

      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();

      expect(block?.transactions[0].status.toBoolean()).toBe(false);
      expect(block?.transactions[0].statusMessage).toBe(
        "message is of the wrong length"
      );
    });
    test("message number is lower than the previous", async () => {
      const agentId = UInt64.from(1);
      const agent = new Agent({
        lastMessageNumber: UInt32.from(2),
        securityCode: Field(4),
      });

      await addAgent(agentId, agent);

      const message = new Message({
        agentId,
        number: UInt32.from(1),
        characters: createMessage("123456789123"),
        securityCode: Field(4),
      });

      const tx = await appChain.transaction(alice, () => {
        module.sendMessage(message);
      });

      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();

      expect(block?.transactions[0].status.toBoolean()).toBe(false);
      expect(block?.transactions[0].statusMessage).toBe(
        "message number is lower than the previous"
      );
    });
  });
});
