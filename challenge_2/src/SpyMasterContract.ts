import {
  Bool,
  Field,
  Provable,
  Reducer,
  SmartContract,
  State,
  UInt32,
  method,
  state,
} from 'o1js';
import { Message } from './Message';

export default class SpyMasterContract extends SmartContract {
  @state(Field) actionState = State<Field>();
  @state(UInt32) highestMessageNumber = State<UInt32>();

  reducer = Reducer({ actionType: Message });

  @method init() {
    super.init();
    this.actionState.set(Reducer.initialActionState);
    this.highestMessageNumber.set(UInt32.from(0));
  }

  @method addMessagee(message: Message) {
    this.reducer.dispatch(message);
  }

  @method processBatchMessages() {
    const actionState = this.actionState.getAndRequireEquals();

    const actions = this.reducer.getActions({ fromActionState: actionState });

    let { state: highestMessageNumber, actionState: newActionState } =
      this.reducer.reduce(
        actions,
        UInt32,
        (state: UInt32, message: Message) => {
          const isAgentIdZero = message.agent.id.equals(UInt32.from(0));

          const isDublicated = message.id.lessThanOrEqual(state);

          // If agent id is zero or dublicated, skip checking
          const isAgentIdValid: Bool = Provable.if(
            isAgentIdZero.or(isDublicated),
            Bool(true),
            message.agent.id
              .greaterThanOrEqual(UInt32.from(0))
              .and(message.agent.id.lessThanOrEqual(UInt32.from(3000)))
          );

          // If agent id is zero or dublicated, skip checking
          const isAgentXLocationValid: Bool = Provable.if(
            isAgentIdZero.or(isDublicated),
            Bool(true),
            message.agent.xLocation
              .greaterThanOrEqual(UInt32.from(0))
              .and(message.agent.xLocation.lessThanOrEqual(UInt32.from(15000)))
          );

          // If agent id is zero or dublicated, skip checking
          const isAgentYLocationValid: Bool = Provable.if(
            isAgentIdZero.or(isDublicated),
            Bool(true),
            message.agent.yLocation
              .greaterThanOrEqual(UInt32.from(5000))
              .and(message.agent.yLocation.lessThanOrEqual(UInt32.from(20000)))
          );

          const isYLocationGreaterThanX: Bool = Provable.if(
            isAgentIdZero.or(isDublicated),
            Bool(true),
            message.agent.yLocation.greaterThan(message.agent.xLocation)
          );

          // If agent id is zero, skip checking
          const isCheckSumValid: Bool = Provable.if(
            isAgentIdZero.or(isDublicated),
            Bool(true),
            message.agent.checkSum.equals(
              message.agent.id
                .add(message.agent.xLocation)
                .add(message.agent.yLocation)
            )
          );

          const isMessageValid = isAgentIdValid
            .and(isAgentXLocationValid)
            .and(isAgentYLocationValid)
            .and(isCheckSumValid)
            .and(isYLocationGreaterThanX);

          const shouldUpdateState = message.id
            .greaterThan(state)
            .and(isMessageValid);

          const result = Provable.if(shouldUpdateState, message.id, state);

          return result;
        },
        {
          state: UInt32.from(0),
          actionState: Reducer.initialActionState,
        },
        {
          maxTransactionsWithActions: 200,
        }
      );

    this.highestMessageNumber.set(highestMessageNumber);
    this.actionState.set(newActionState);
  }
}
