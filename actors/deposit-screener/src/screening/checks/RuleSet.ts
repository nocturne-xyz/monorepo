import { ScreeningDepositRequest } from "..";
import { API_CALLS, ApiMap, Data } from "./apiCalls";
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

export interface RuleParams<K extends keyof ApiMap> {
  name: string;
  call: K;
  threshold: (data: ApiMap[K]) => boolean;
  action: Rejection | DelayAction;
}

export class Rule<K extends keyof ApiMap> {
  public next: Rule<any> | null;
  public readonly name: RuleParams<K>["name"];
  private threshold: RuleParams<K>["threshold"];
  private call: RuleParams<K>["call"];
  private action: RuleParams<K>["action"];

  constructor({ name, call, threshold, action }: RuleParams<K>) {
    this.next = null;
    this.name = name;
    this.call = call;
    this.threshold = threshold;
    this.action = action;
  }

  async check(
    deposit: ScreeningDepositRequest,
    cache: Record<K, ApiMap[K]>
  ): Promise<Rejection | DelayAction | typeof ACTION_NOT_TRIGGERED> {
    if (!cache[this.call]) {
      cache[this.call] = (await API_CALLS[this.call](deposit)) as ApiMap[K];
    }
    const data = cache[this.call];
    return this.threshold(data) ? this.action : ACTION_NOT_TRIGGERED;
  }
}

export class RuleSet {
  private head: Rule<any> | null = null;
  private tail: Rule<any> | null = null;
  private delaySeconds;

  constructor({ baseDelaySeconds = 0 }: { baseDelaySeconds?: number } = {}) {
    this.delaySeconds = baseDelaySeconds;
  }

  add<K extends keyof ApiMap>(ruleParams: RuleParams<K>): RuleSet {
    const rule = new Rule(ruleParams);
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
        this.delaySeconds = APPLY_DELAY_OPERATION[result.operation](
          this.delaySeconds,
          result.value
        );
      }
      currRule = currRule.next;
    }
    console.log(`Screener results for deposit:`, deposit, rulesLogList);
    return { type: "Delay", timeSeconds: this.delaySeconds };
  }
}
