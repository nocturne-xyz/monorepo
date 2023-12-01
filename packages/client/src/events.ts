import EventEmitter from "eventemitter3";

export type Events = {
  // fires when progress meter for syncing is updated
  SYNC_PROGRESS: Percentage;

  // fires on every state diff
  // TODO add a payload saying what changed that allows subscribers to filter
  STATE_DIFF: undefined;

  // TODO: add a more specific "BALANCE_DIFF" event
};
export type EventKind = keyof Events;

export type Percentage = number;

export type UnsubscribeFn = () => void;

export class NocturneEventBus {
  protected emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  emit<E extends EventKind>(tag: E, payload: Events[E]): void {
    this.emitter.emit(tag, payload);
  }

  setTimer<E extends keyof Events>(
    tag: E,
    payload: Events[E],
    timer: number
  ): void {
    const emit = () => {
      this.emitter.emit(tag, payload);
      setTimeout(emit, timer);
    };

    emit();
  }

  subscribe<E extends EventKind>(
    tag: E,
    callback: (payload: Events[E]) => void
  ): UnsubscribeFn {
    this.emitter.on(tag, callback);

    return () => {
      this.emitter.off(tag, callback);
    };
  }
}
