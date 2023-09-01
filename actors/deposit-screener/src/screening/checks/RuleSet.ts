import { ScreeningDepositRequest } from "..";
import { API_CALLS, Data } from "./apiCalls";

export interface Rejection {
  type: "Rejection";
  reason: string;
}
export interface Delay {
  type: "Delay";
  timeSeconds: number;
}

export class Rule<T extends Data> {
  public next: Rule<any> | null;
  private threshold: (data: T) => boolean;
  private call: keyof typeof API_CALLS;
  private action: Rejection | Delay;
  constructor({
    call,
    threshold,
    action,
  }: {
    call: keyof typeof API_CALLS;
    threshold: (data: T) => boolean;
    action: Rejection | Delay;
  }) {
    this.next = null;
    this.call = call;
    this.threshold = threshold;
    this.action = action;
  }

  async check(
    deposit: ScreeningDepositRequest,
    cache: Record<string, Data>
  ): Promise<Rejection | Delay | undefined> {
    if (!cache[this.call]) {
      cache[this.call] = await API_CALLS[this.call](deposit);
    }
    const data = cache[this.call] as T;
    return this.threshold(data) ? this.action : undefined;
  }
}

export class RuleSet {
  private head: Rule<any> | null = null;
  private tail: Rule<any> | null = null;
  private delay = 0;

  add<T extends Data>(rule: Rule<T>): RuleSet {
    if (!this.head) {
      this.head = rule;
    } else {
      this.tail!.next = rule;
    }
    this.tail = rule;
    return this;
  }

  async check(deposit: ScreeningDepositRequest): Promise<Rejection | Delay> {
    let currRule = this.head;
    const cache: Record<string, Data> = {};
    while (currRule !== null) {
      const result = await currRule.check(deposit, cache);
      if (result) {
        if (result.type === "Rejection") {
          return result;
        }
        this.delay += result.timeSeconds;
      }
      currRule = currRule.next;
    }
    return { type: "Delay", timeSeconds: this.delay };
  }
}
