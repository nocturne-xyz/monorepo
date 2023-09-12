import { ScreeningDepositRequest } from "..";
import { API_CALLS, ApiCallKeys, ApiMap, Data } from "./apiCalls";
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

export type PartialRuleParams<K extends keyof ApiMap> = Omit<
  RuleParams<K>,
  "action"
>;

export interface CombinedRulesParams<T extends ReadonlyArray<keyof ApiMap>> {
  partials: { readonly [K in keyof T]: PartialRuleParams<T[K]> };
  action: Rejection | DelayAction;
  applyIf: "Any" | "All";
}

export interface RuleLike {
  next: RuleLike | null;
  name: string;
  check: (
    deposit: ScreeningDepositRequest,
    cache: Record<ApiCallKeys, ApiMap[ApiCallKeys]>
  ) => Promise<Rejection | DelayAction | typeof ACTION_NOT_TRIGGERED>;
}

export class Rule<K extends keyof ApiMap> implements RuleLike {
  public next: RuleLike | null = null;
  public readonly name: RuleParams<K>["name"];
  private threshold: RuleParams<K>["threshold"];
  private call: RuleParams<K>["call"];
  private action: RuleParams<K>["action"];

  constructor({ name, call, threshold, action }: RuleParams<K>) {
    this.name = name;
    this.call = call;
    this.threshold = threshold;
    this.action = action;
  }

  async check(
    deposit: ScreeningDepositRequest,
    cache: Record<ApiCallKeys, ApiMap[ApiCallKeys]>
  ): Promise<Rejection | DelayAction | typeof ACTION_NOT_TRIGGERED> {
    if (!cache[this.call]) {
      cache[this.call] = await API_CALLS[this.call](deposit);
    }
    const data = cache[this.call] as ApiMap[K];
    return this.threshold(data) ? this.action : ACTION_NOT_TRIGGERED;
  }
}

export class CompositeRule<T extends ReadonlyArray<keyof ApiMap>>
  implements RuleLike
{
  public next: RuleLike | null = null;
  public readonly name: string;
  private partials: CombinedRulesParams<T>["partials"];
  private action: CombinedRulesParams<T>["action"];
  private predicateFn: "some" | "every"; // corresponds to Array.prototype's `some` and `every`

  constructor(params: CombinedRulesParams<T>) {
    this.name = `Composite(${params.partials.map((r) => r.name).join(", ")}):${
      params.applyIf
    }`;
    this.partials = params.partials;
    this.action = params.action;
    this.predicateFn = params.applyIf === "Any" ? "some" : "every";
  }

  async check(
    deposit: ScreeningDepositRequest,
    cache: Record<ApiCallKeys, Data>
  ): Promise<Rejection | DelayAction | typeof ACTION_NOT_TRIGGERED> {
    const results = await Promise.all(
      this.partials.map(async (partial) => {
        if (!cache[partial.call]) {
          cache[partial.call] = await API_CALLS[partial.call](deposit);
        }
        const data = cache[partial.call] as ApiMap[typeof partial.call];

        return partial.threshold(data);
      })
    );
    const shouldApplyRule = results[this.predicateFn]((_) => _);
    return shouldApplyRule ? this.action : ACTION_NOT_TRIGGERED;
  }
}

export class RuleSet {
  private head: RuleLike | null = null;
  private tail: RuleLike | null = null;
  private delaySeconds;

  constructor({ baseDelaySeconds = 0 }: { baseDelaySeconds?: number } = {}) {
    this.delaySeconds = baseDelaySeconds;
  }

  private _add(ruleLike: RuleLike) {
    if (!this.head) {
      this.head = ruleLike;
    } else {
      this.tail!.next = ruleLike;
    }
    this.tail = ruleLike;
  }

  add<K extends keyof ApiMap>(ruleParams: RuleParams<K>): RuleSet {
    const rule = new Rule(ruleParams);
    this._add(rule);
    return this;
  }

  combineAndAdd<T extends ReadonlyArray<keyof ApiMap>>(
    compositeParams: CombinedRulesParams<T>
  ): RuleSet {
    const composite = new CompositeRule(compositeParams);
    this._add(composite);
    return this;
  }

  async check(deposit: ScreeningDepositRequest): Promise<Rejection | Delay> {
    let currRule = this.head;
    const cache: Record<string, Data> = {};
    const rulesLogList: {
      ruleName: string;
      result: Awaited<ReturnType<RuleLike["check"]>>;
    }[] = [];
    while (currRule !== null) {
      const result = await currRule.check(deposit, cache);
      rulesLogList.push({
        ruleName: currRule.name,
        result,
      });
      if (result.type === "Rejection") {
        console.log(`Screener execution for deposit:`, deposit, rulesLogList);
        return result;
      } else if (result.type === "Delay") {
        this.delaySeconds = APPLY_DELAY_OPERATION[result.operation](
          this.delaySeconds,
          result.value
        );
      }
      currRule = currRule.next;
    }
    console.log(`Screener execution for deposit:`, deposit, rulesLogList);
    return { type: "Delay", timeSeconds: this.delaySeconds };
  }
}
