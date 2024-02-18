import { Struct, UInt32 } from "o1js";
import Agent from "./Agent";

export class Message extends Struct({
  id: UInt32,
  agent: Agent
}) {}