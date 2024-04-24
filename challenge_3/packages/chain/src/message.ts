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

export const CHARACTER_LENGTH = 12;
export const Characters = Provable.Array(Character, CHARACTER_LENGTH);

export function createMessage(message: string): Character[] {
  const characters: Character[] = [];

  for (let i = 0; i < CHARACTER_LENGTH; i++) {
    const char = message.charAt(i);
    if (char) {
      characters.push(Character.fromString(char));
    } else {
      characters.push(new Character(Field(0)));
    }
  }

  return characters;
}

export class Message extends Struct({
  agentId: UInt64,
  number: UInt32,
  characters: Characters,
  securityCode: Field,
}) {}

export class Agent extends Struct({
  lastMessageNumber: UInt32,
  securityCode: Field,
}) {}

const MESSAGE_LENGTH = UInt32.from(12);

export class MessageModule extends RuntimeModule<Record<string, never>> {
  @state() public currentState = StateMap.from<UInt64, Agent>(UInt64, Agent);

  @runtimeMethod()
  public addAgent(id: UInt64, agent: Agent) {
    this.currentState.set(id, agent);
  }

  @runtimeMethod()
  public sendMessage(message: Message) {
    // The AgentID exists in the system
    assert(
      this.currentState.get(message.agentId).isSome.equals(true),
      "agent does not exist in the system"
    );

    const agent = this.currentState.get(message.agentId).value;
    // The security code matches that held for that AgentID
    assert(
      agent.securityCode.equals(message.securityCode),
      "security code does not match"
    );

    // The message is of the correct length.
    for (let i = 0; i < CHARACTER_LENGTH; i++) {
      assert(
        message.characters[i].isNull().equals(false),
        "message is of the wrong length"
      );
    }

    // The message number is greater than the highest so far for that agent.
    assert(
      message.number.greaterThan(agent.lastMessageNumber),
      "message number is lower than the previous"
    );

    agent.lastMessageNumber = message.number;

    // You should update the agent state to store the last message number received.
    this.currentState.set(message.agentId, agent);
  }
}
