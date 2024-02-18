import {
  Mina,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  UInt32,
  Provable,
} from 'o1js';
import SpyMasterContract from './SpyMasterContract';
import { Message } from './Message';
import Agent from './Agent';

let proofsEnabled = false;

describe('SpyMasterContract', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    spyMasterApp: SpyMasterContract;

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);

    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    ({ privateKey: senderKey, publicKey: senderAccount } =
      Local.testAccounts[1]);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    spyMasterApp = new SpyMasterContract(zkAppAddress);
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      spyMasterApp.deploy();
    });
    await txn.prove();
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  function generateMessage(amount: number): Message[] {
    const messages: Message[] = [];

    for (let i = 0; i < amount; i += 1) {
      messages[i] = new Message({
        id: UInt32.from(i),
        agent: new Agent({
          id: UInt32.from(i + i),
          xLocation: UInt32.from(1500),
          yLocation: UInt32.from(5500),
          checkSum: UInt32.from(i + i + 1500 + 5500),
        }),
      });
    }

    return messages;
  }

  describe('processBatchMessages', () => {
    test('Process 200 sequential valid messages. Return highest message number === 199', async () => {
      await localDeploy();

      console.log('add messages');
      for (const message of generateMessage(200)) {
        const txn = await Mina.transaction(senderAccount, () => {
          spyMasterApp.addMessagee(message);
        });

        await txn.prove();
        await txn.sign([senderKey, zkAppPrivateKey]).send();
      }

      console.log('process messages');
      const txn = await Mina.transaction(senderAccount, () => {
        spyMasterApp.processBatchMessages();
      });

      await txn.prove();
      await txn.sign([senderKey, zkAppPrivateKey]).send();

      console.log(
        'spyMasterApp.highestMessageNumber.get()',
        spyMasterApp.highestMessageNumber.get()
      );

      expect(spyMasterApp.highestMessageNumber.get()).toEqual(UInt32.from(199));
    });

    test('Process 10 messages. The last one has invalid checksum, so the prev number will be final', async () => {
      await localDeploy();

      console.log('add messages');
      const messages = generateMessage(10);

      //Invalid message
      messages[9].agent.checkSum = UInt32.from(19);

      for (const message of messages) {
        const txn = await Mina.transaction(senderAccount, () => {
          spyMasterApp.addMessagee(message);
        });

        await txn.prove();
        await txn.sign([senderKey, zkAppPrivateKey]).send();
      }

      Provable.log(
        'process messages',
        await spyMasterApp.reducer.fetchActions({
          fromActionState: spyMasterApp.actionState.get(),
        })
      );
      const txn = await Mina.transaction(senderAccount, () => {
        spyMasterApp.processBatchMessages();
      });

      await txn.prove();
      await txn.sign([senderKey, zkAppPrivateKey]).send();

      console.log(
        'spyMasterApp.highestMessageNumber.get()',
        spyMasterApp.highestMessageNumber.get()
      );

      expect(spyMasterApp.highestMessageNumber.get()).toEqual(UInt32.from(8));
    });

    test('Process 10 messages. The last one has invalid xLocation, so the prev number will be final', async () => {
      await localDeploy();

      console.log('add messages');
      const messages = generateMessage(10);

      //Invalid message
      messages[9].agent.xLocation = UInt32.from(100_000);

      for (const message of messages) {
        const txn = await Mina.transaction(senderAccount, () => {
          spyMasterApp.addMessagee(message);
        });

        await txn.prove();
        await txn.sign([senderKey, zkAppPrivateKey]).send();
      }

      console.log('process messages');
      const txn = await Mina.transaction(senderAccount, () => {
        spyMasterApp.processBatchMessages();
      });

      await txn.prove();
      await txn.sign([senderKey, zkAppPrivateKey]).send();

      console.log(
        'spyMasterApp.highestMessageNumber.get()',
        spyMasterApp.highestMessageNumber.get()
      );

      expect(spyMasterApp.highestMessageNumber.get()).toEqual(UInt32.from(8));
    });

    test('Process 10 messages. The last one has invalid yLocation, so the prev number will be final', async () => {
      await localDeploy();

      console.log('add messages');
      const messages = generateMessage(10);

      //Invalid message
      messages[9].agent.yLocation = UInt32.from(100_000);

      for (const message of messages) {
        const txn = await Mina.transaction(senderAccount, () => {
          spyMasterApp.addMessagee(message);
        });

        await txn.prove();
        await txn.sign([senderKey, zkAppPrivateKey]).send();
      }

      console.log('process messages');
      const txn = await Mina.transaction(senderAccount, () => {
        spyMasterApp.processBatchMessages();
      });

      await txn.prove();
      await txn.sign([senderKey, zkAppPrivateKey]).send();

      console.log(
        'spyMasterApp.highestMessageNumber.get()',
        spyMasterApp.highestMessageNumber.get()
      );

      expect(spyMasterApp.highestMessageNumber.get()).toEqual(UInt32.from(8));
    });

    test('Process 10 messages. The last one has invalid agent id, so the prev number will be final', async () => {
      await localDeploy();

      console.log('add messages');
      const messages = generateMessage(10);

      //Invalid message
      messages[9].agent.id = UInt32.from(100_000);

      for (const message of messages) {
        const txn = await Mina.transaction(senderAccount, () => {
          spyMasterApp.addMessagee(message);
        });

        await txn.prove();
        await txn.sign([senderKey, zkAppPrivateKey]).send();
      }

      console.log('process messages');
      const txn = await Mina.transaction(senderAccount, () => {
        spyMasterApp.processBatchMessages();
      });

      await txn.prove();
      await txn.sign([senderKey, zkAppPrivateKey]).send();

      console.log(
        'spyMasterApp.highestMessageNumber.get()',
        spyMasterApp.highestMessageNumber.get()
      );

      expect(spyMasterApp.highestMessageNumber.get()).toEqual(UInt32.from(8));
    });

    test('Process 10 messages with random order of ids. The highest number is 50000', async () => {
      await localDeploy();

      console.log('add messages');
      const messages = generateMessage(10);

      //Invalid message
      messages[0].id = UInt32.from(550);
      messages[1].id = UInt32.from(1231);
      messages[2].id = UInt32.from(3456);
      messages[3].id = UInt32.from(2435);
      messages[4].id = UInt32.from(546);
      messages[5].id = UInt32.from(50000); // max number
      messages[6].id = UInt32.from(867);
      messages[7].id = UInt32.from(100);
      messages[8].id = UInt32.from(1231);
      messages[9].id = UInt32.from(0);

      for (const message of messages) {
        const txn = await Mina.transaction(senderAccount, () => {
          spyMasterApp.addMessagee(message);
        });

        await txn.prove();
        await txn.sign([senderKey, zkAppPrivateKey]).send();
      }

      console.log('process messages');
      const txn = await Mina.transaction(senderAccount, () => {
        spyMasterApp.processBatchMessages();
      });

      await txn.prove();
      await txn.sign([senderKey, zkAppPrivateKey]).send();

      console.log(
        'spyMasterApp.highestMessageNumber.get()',
        spyMasterApp.highestMessageNumber.get()
      );

      expect(spyMasterApp.highestMessageNumber.get()).toEqual(
        UInt32.from(50000)
      );
    });

    test('Process 10 messages. One of the message has a message number to equal with invalid check sum. Messages should be process successfully', async () => {
      await localDeploy();

      console.log('add messages');
      const messages = generateMessage(10);

      //Invalid message
      messages[5].id = UInt32.from(5);
      messages[5].agent.checkSum = UInt32.from(1);

      for (const message of messages) {
        const txn = await Mina.transaction(senderAccount, () => {
          spyMasterApp.addMessagee(message);
        });

        await txn.prove();
        await txn.sign([senderKey, zkAppPrivateKey]).send();
      }

      console.log('process messages');
      const txn = await Mina.transaction(senderAccount, () => {
        spyMasterApp.processBatchMessages();
      });

      await txn.prove();
      await txn.sign([senderKey, zkAppPrivateKey]).send();

      console.log(
        'spyMasterApp.highestMessageNumber.get()',
        spyMasterApp.highestMessageNumber.get()
      );

      expect(spyMasterApp.highestMessageNumber.get()).toEqual(UInt32.from(9));
    });

    test('Process 10 messages. Two messages are dublicated, the second has invalid checksum. Messages should be process successfully', async () => {
      await localDeploy();

      console.log('add messages');
      const messages = generateMessage(10);

      //Invalid message
      messages[5].id = UInt32.from(5);

      messages[6].id = UInt32.from(5);
      messages[6].agent.checkSum = UInt32.from(1);

      for (const message of messages) {
        const txn = await Mina.transaction(senderAccount, () => {
          spyMasterApp.addMessagee(message);
        });

        await txn.prove();
        await txn.sign([senderKey, zkAppPrivateKey]).send();
      }

      console.log('process messages');
      const txn = await Mina.transaction(senderAccount, () => {
        spyMasterApp.processBatchMessages();
      });

      await txn.prove();
      await txn.sign([senderKey, zkAppPrivateKey]).send();

      console.log(
        'spyMasterApp.highestMessageNumber.get()',
        spyMasterApp.highestMessageNumber.get()
      );

      expect(spyMasterApp.highestMessageNumber.get()).toEqual(UInt32.from(9));
    });

    test('Process 10 messages. One message has agent id equal to zero, but with invalid checksum. Messages should be process successfully', async () => {
      await localDeploy();

      console.log('add messages');
      const messages = generateMessage(10);

      //Invalid message
      messages[5].id = UInt32.from(0);

      messages[6].id = UInt32.from(0);
      messages[6].agent.checkSum = UInt32.from(1);

      for (const message of messages) {
        const txn = await Mina.transaction(senderAccount, () => {
          spyMasterApp.addMessagee(message);
        });

        await txn.prove();
        await txn.sign([senderKey, zkAppPrivateKey]).send();
      }

      console.log('process messages');
      const txn = await Mina.transaction(senderAccount, () => {
        spyMasterApp.processBatchMessages();
      });

      await txn.prove();
      await txn.sign([senderKey, zkAppPrivateKey]).send();

      console.log(
        'spyMasterApp.highestMessageNumber.get()',
        spyMasterApp.highestMessageNumber.get()
      );

      expect(spyMasterApp.highestMessageNumber.get()).toEqual(UInt32.from(9));
    });
  });
});
