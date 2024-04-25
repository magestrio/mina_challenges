import { Character, Field, Provable, PublicKey, Struct, UInt32, UInt64 } from "o1js";

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

export class MessageAppState extends Struct({
  agentId: UInt64,
  blockHeight: UInt64,
  sender: PublicKey,
  nonce: UInt64,
  lastMessageNumber: UInt32,
  securityCodeHash: Field,
}) {}

export class MessageAppStateOutput extends Struct({
  agentId: UInt64,
  lastMessageNumber: UInt32,
  securityCodeHash: Field,
}) {}