import { SecretMessageContract, setMaxAddress } from './SecretMessage';
import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  MerkleMap,
  Poseidon,
  UInt32,
} from 'o1js';

function createPublicKeysArray(size: number): PublicKey[] {
  const publicKeys: PublicKey[] = [];

  for (let i = 0; i < size; i++) {
    const privateKey = PrivateKey.random();
    const publicKey = privateKey.toPublicKey();
    publicKeys.push(publicKey);
  }

  return publicKeys;
}

let proofsEnabled = false;

describe('SecretMessageContract', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    userAccount: PublicKey,
    userKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    secretMessageApp: SecretMessageContract;

  beforeAll(async () => {
    if (proofsEnabled) await SecretMessageContract.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    ({ privateKey: senderKey, publicKey: senderAccount } =
      Local.testAccounts[1]);
    ({ privateKey: userKey, publicKey: userAccount } = Local.testAccounts[2]);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    secretMessageApp = new SecretMessageContract(zkAppAddress);
  });

  async function localDeploy(userRoot: Field) {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      secretMessageApp.deploy();

      secretMessageApp.initState(userRoot);
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  async function addEligibleAddress(
    addresses: PublicKey[],
    merkleMap: MerkleMap
  ) {
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      merkleMap.set(
        address.toFields()[0],
        Poseidon.hash(address.toFields())
      );

      const txn = await Mina.transaction(senderAccount, () => {
        secretMessageApp.addEligibleAddress(
          address,
          merkleMap.getWitness(address.toFields()[0])
        );
      });

      await txn.prove();
      await txn.sign([senderKey]).send();
    }
  }

  describe('addEligibleAddress', () => {
    it('Successfully add eligible address', async () => {
      const merkleTree = new MerkleMap();
      await localDeploy(merkleTree.getRoot());

      setMaxAddress(5);

      const addresses = createPublicKeysArray(5);

      await addEligibleAddress(addresses, merkleTree);

      expect(secretMessageApp.userRoot.get()).toEqual(merkleTree.getRoot());
    });

    it('Add more addresses than allowed', async () => {
      const merkleTree = new MerkleMap();
      await localDeploy(merkleTree.getRoot());

      setMaxAddress(5);

      const addresses = createPublicKeysArray(5);

      await addEligibleAddress(addresses, merkleTree);

      expect(secretMessageApp.userRoot.get()).toEqual(merkleTree.getRoot());
      const address = PrivateKey.random().toPublicKey();
      merkleTree.set(address.toFields()[0], address.toFields()[0]);

      expect(async () => {
        await Mina.transaction(senderAccount, () => {
          secretMessageApp.addEligibleAddress(
            address,
            merkleTree.getWitness(address.toFields()[0])
          );
        });
      }).rejects;
    });
  });

  describe('depositMessage', () => {
    it('the same address try to deposit a message twice', async () => {
      const MESSAGE = Field(0b1110011010100000);
      const merkleTree = new MerkleMap();

      await localDeploy(merkleTree.getRoot());

      merkleTree.set(
        userAccount.toFields()[0],
        Poseidon.hash(MESSAGE.toFields())
      );

      let txn = await Mina.transaction(senderAccount, () => {
        secretMessageApp.addEligibleAddress(
          userAccount,
          merkleTree.getWitness(userAccount.toFields()[0])
        );
      });

      await txn.prove();
      await txn.sign([senderKey]).send();

      txn = await Mina.transaction(userAccount, () => {
        secretMessageApp.depositMessage(
          merkleTree.getWitness(userAccount.toFields()[0]),
          MESSAGE
        );
      });

      await txn.prove();
      await txn.sign([userKey]).send();

      expect(async () => {
        await Mina.transaction(userAccount, () => {
          secretMessageApp.depositMessage(
            merkleTree.getWitness(userAccount.toFields()[0]),
            MESSAGE
          );
        });
      }).rejects;
    });

    it('message counted correctly', async () => {
      const MESSAGE = Field(0b1110011010100000);
      const merkleTree = new MerkleMap();

      await localDeploy(merkleTree.getRoot());

      merkleTree.set(
        userAccount.toFields()[0],
        Poseidon.hash(userAccount.toFields().concat(Field(0)))
      );

      let txn = await Mina.transaction(senderAccount, () => {
        secretMessageApp.addEligibleAddress(
          userAccount,
          merkleTree.getWitness(userAccount.toFields()[0])
        );
      });

      await txn.prove();
      await txn.sign([senderKey]).send();

      merkleTree.set(
        userAccount.toFields()[0],
        Poseidon.hash(MESSAGE.toFields())
      );

      txn = await Mina.transaction(userAccount, () => {
        secretMessageApp.depositMessage(
          merkleTree.getWitness(userAccount.toFields()[0]),
          MESSAGE
        );
      });

      await txn.prove();
      await txn.sign([userKey]).send();

      expect(secretMessageApp.messageCounter.get()).toEqual(UInt32.from(1));
    });
  });

  describe('checkFlags', () => {
    it('SUCCESS CHECK: If flag 1 is true, then all other flags must be false', async () => {
      const MESSAGE = Field(0b1110011010100000);
      const merkleTree = new MerkleMap();

      await localDeploy(merkleTree.getRoot());

      merkleTree.set(
        userAccount.toFields()[0],
        Poseidon.hash(userAccount.toFields().concat(Field(0)))
      );

      let txn = await Mina.transaction(senderAccount, () => {
        secretMessageApp.addEligibleAddress(
          userAccount,
          merkleTree.getWitness(userAccount.toFields()[0])
        );
      });

      await txn.prove();
      await txn.sign([senderKey]).send();

      txn = await Mina.transaction(userAccount, () => {
        secretMessageApp.checkFlags(MESSAGE);
      });

      await txn.prove();
      await txn.sign([userKey]).send();
    });

    it('FAIL CHECK: If flag 1 is true, then all other flags must be false', async () => {
      const MESSAGE = Field(0b1110011010100100);
      const merkleTree = new MerkleMap();

      await localDeploy(merkleTree.getRoot());

      merkleTree.set(
        userAccount.toFields()[0],
        Poseidon.hash(userAccount.toFields().concat(Field(0)))
      );

      let txn = await Mina.transaction(senderAccount, () => {
        secretMessageApp.addEligibleAddress(
          userAccount,
          merkleTree.getWitness(userAccount.toFields()[0])
        );
      });

      await txn.prove();
      await txn.sign([senderKey]).send();

      expect(async () => {
        await Mina.transaction(userAccount, () => {
          secretMessageApp.checkFlags(MESSAGE);
        });
      }).rejects;
    });

    it('SUCCESS CHECK: If flag 2 is true, then flag 3 must also be true', async () => {
      const MESSAGE = Field(0b1110011010011001);
      const merkleTree = new MerkleMap();

      await localDeploy(merkleTree.getRoot());

      merkleTree.set(
        userAccount.toFields()[0],
        Poseidon.hash(userAccount.toFields().concat(Field(0)))
      );

      let txn = await Mina.transaction(senderAccount, () => {
        secretMessageApp.addEligibleAddress(
          userAccount,
          merkleTree.getWitness(userAccount.toFields()[0])
        );
      });

      await txn.prove();
      await txn.sign([senderKey]).send();

      txn = await Mina.transaction(userAccount, () => {
        secretMessageApp.checkFlags(MESSAGE);
      });

      await txn.prove();
      await txn.sign([userKey]).send();
    });

    it('FAIL CHECK: If flag 2 is true, then flag 3 must also be true', async () => {
      const MESSAGE = Field(0b1110011010010100);
      const merkleTree = new MerkleMap();
      await localDeploy(merkleTree.getRoot());

      merkleTree.set(
        userAccount.toFields()[0],
        Poseidon.hash(userAccount.toFields().concat(Field(0)))
      );

      let txn = await Mina.transaction(senderAccount, () => {
        secretMessageApp.addEligibleAddress(
          userAccount,
          merkleTree.getWitness(userAccount.toFields()[0])
        );
      });

      await txn.prove();
      await txn.sign([senderKey]).send();

      expect(async () => {
        await Mina.transaction(userAccount, () => {
          secretMessageApp.checkFlags(MESSAGE);
        });
      }).rejects;
    });

    it('SUCCESS CHECK: If flag 4 is true, then flags 5 and 6 must be false', async () => {
      const MESSAGE = Field(0b1110011010001100);
      const merkleTree = new MerkleMap();

      await localDeploy(merkleTree.getRoot());

      merkleTree.set(
        userAccount.toFields()[0],
        Poseidon.hash(userAccount.toFields().concat(Field(0)))
      );

      let txn = await Mina.transaction(senderAccount, () => {
        secretMessageApp.addEligibleAddress(
          userAccount,
          merkleTree.getWitness(userAccount.toFields()[0])
        );
      });

      await txn.prove();
      await txn.sign([senderKey]).send();

      txn = await Mina.transaction(userAccount, () => {
        secretMessageApp.checkFlags(MESSAGE);
      });

      await txn.prove();
      await txn.sign([userKey]).send();
    });

    it('FAIL CHECK: If flag 4 is true, then flags 5 and 6 must be false', async () => {
      const MESSAGE = Field(0b1110011010000101);
      const merkleTree = new MerkleMap();

      await localDeploy(merkleTree.getRoot());

      merkleTree.set(
        userAccount.toFields()[0],
        Poseidon.hash(userAccount.toFields().concat(Field(0)))
      );

      let txn = await Mina.transaction(senderAccount, () => {
        secretMessageApp.addEligibleAddress(
          userAccount,
          merkleTree.getWitness(userAccount.toFields()[0])
        );
      });

      await txn.prove();
      await txn.sign([senderKey]).send();

      expect(async () => {
        await Mina.transaction(userAccount, () => {
          secretMessageApp.checkFlags(MESSAGE);
        });
      }).rejects;
    });
  });
});
