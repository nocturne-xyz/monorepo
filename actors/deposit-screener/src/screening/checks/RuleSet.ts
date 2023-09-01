import { ScreeningDepositRequest } from "..";
import { API_CALLS, Data } from "./apiCalls";
export interface Rejection {
  type: "Rejection";
  reason: string;
}

export interface AddDelay {
  operation: "Add";
  value: number;
}

export interface MultiplyDelay {
  operation: "Multiply";
  value: number;
}

export type DelayAction = (AddDelay | MultiplyDelay) & { type: "Delay" };

const APPLY_DELAY_OPERATION: Record<
  DelayAction["operation"],
  (a: number, b: number) => number
> = {
  Add: (a, b) => a + b,
  Multiply: (a, b) => a * b,
};

export interface Delay {
  type: "Delay";
  timeSeconds: number;
}

const ACTION_NOT_TRIGGERED = {
  type: "ActionNotTriggered",
} as const;

export interface RuleParams<T extends Data> {
  name: string;
  call: keyof typeof API_CALLS;
  threshold: (data: T) => boolean;
  action: Rejection | DelayAction;
}

export class Rule<T extends Data> {
  public next: Rule<any> | null;
  public readonly name: string;
  private threshold: (data: T) => boolean;
  private call: keyof typeof API_CALLS;
  private action: Rejection | DelayAction;

  constructor({ name, call, threshold, action }: RuleParams<T>) {
    this.next = null;
    this.name = name;
    this.call = call;
    this.threshold = threshold;
    this.action = action;
  }

  async check(
    deposit: ScreeningDepositRequest,
    cache: Record<string, Data>
  ): Promise<Rejection | DelayAction | typeof ACTION_NOT_TRIGGERED> {
    if (!cache[this.call]) {
      cache[this.call] = await API_CALLS[this.call](deposit);
    }
    const data = cache[this.call] as T;
    return this.threshold(data) ? this.action : ACTION_NOT_TRIGGERED;
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
    const rulesLogList: {
      ruleName: string;
      result: Awaited<ReturnType<Rule<any>["check"]>>;
    }[] = [];
    while (currRule !== null) {
      const result = await currRule.check(deposit, cache);
      rulesLogList.push({
        ruleName: currRule.name,
        result,
      });
      if (result.type === "Rejection") {
        console.log(rulesLogList);
        return result;
      } else if (result.type === "Delay") {
        this.delay = APPLY_DELAY_OPERATION[result.operation](
          this.delay,
          result.value
        );
      }
      currRule = currRule.next;
    }
    console.log(`Screener results for deposit:`, deposit, rulesLogList);
    return { type: "Delay", timeSeconds: this.delay };
  }
}
