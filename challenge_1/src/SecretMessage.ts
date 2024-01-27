import {
  Field,
  UInt32,
  PublicKey,
  SmartContract,
  State,
  method,
  state,
  Provable,
  MerkleMapWitness,
  Bool,
  Gadgets,
  Poseidon,
} from 'o1js';

let MAX_ADDRESS = 100;

// for testingPurpose
export function setMaxAddress(amount: number) {
  MAX_ADDRESS = amount;
}

export class SecretMessageContract extends SmartContract {
  @state(Field) userRoot = State<Field>();
  @state(UInt32) addressesAmount = State<UInt32>();

  @state(UInt32) messageCounter = State<UInt32>();

  @state(Field) messageRoot = State<Field>();

  events = {
    'message-notifier': Field,
  };

  @method init() {
    super.init();
    this.messageCounter.set(UInt32.from(0));
  }

  @method initState(userRoot: Field) {
    this.userRoot.set(userRoot);
  }

  @method addEligibleAddress(address: PublicKey, path: MerkleMapWitness) {
    const amount = this.addressesAmount.getAndRequireEquals();

    amount.assertLessThan(UInt32.from(MAX_ADDRESS));

    const root = this.userRoot.get();
    this.userRoot.requireEquals(root);

    const [rootBefore, key] = path.computeRootAndKey(Field(0));
    rootBefore.assertEquals(root);
    key.assertEquals(address.toFields()[0]);

    const [newRoot, _] = path.computeRootAndKey(
      Poseidon.hash(address.toFields())
    );

    this.userRoot.set(newRoot);
  }

  @method depositMessage(userWitness: MerkleMapWitness, message: Field) {
    const root = this.userRoot.get();
    this.userRoot.requireEquals(root);

    // check eligibility and accessibility
    const address = this.sender;
    const [rootBefore, key] = userWitness.computeRootAndKey(
      Poseidon.hash(address.toFields())
    );

    // If fail, the message is already included
    rootBefore.assertEquals(root);
    address.toFields()[0].assertEquals(key);

    const messageHash = Poseidon.hash(message.toFields());
    const [newRoot, _] = userWitness.computeRootAndKey(messageHash);
    this.userRoot.set(newRoot);

    // check message
    this.checkFlags(message);

    const messageCounter = this.messageCounter.getAndRequireEquals();
    this.messageCounter.set(messageCounter.add(1));

    this.emitEvent('message-notifier', messageHash);
  }

  @method checkFlags(message: Field) {
    // First check
    const flag1 = Gadgets.rightShift64(
      Gadgets.and(message, Field(0b100000), 6),
      5
    );

    const check1 = Provable.if(
      flag1.equals(1),
      Gadgets.and(message, Field(0b11111), 5).equals(0),
      Bool(true)
    );

    check1.assertTrue();

    // Second check
    const flag2 = Gadgets.rightShift64(
      Gadgets.and(message, Field(0b010000), 5),
      4
    );

    const flag3 = Gadgets.rightShift64(
      Gadgets.and(message, Field(0b001000), 4),
      3
    );

    const check2 = Provable.if(flag2.equals(1), flag3.equals(1), Bool(true));

    check2.assertTrue();

    // Third check
    const flag4 = Gadgets.rightShift64(
      Gadgets.and(message, Field(0b000100), 3),
      2
    );

    const check3 = Provable.if(
      flag4.equals(1),
      Gadgets.and(message, Field(0b11), 2).equals(0),
      Bool(true)
    );

    check3.assertTrue();
  }
}
