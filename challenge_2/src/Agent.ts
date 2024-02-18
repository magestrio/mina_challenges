import { Struct, UInt32 } from "o1js";

export default class Agent extends Struct({
  id: UInt32,
  xLocation: UInt32,
  yLocation: UInt32,
  checkSum: UInt32
}) {}