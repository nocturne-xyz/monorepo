import { ScreeningDepositRequest } from "..";
import {
  API_CALL_MAP,
  ApiCallNames,
  ApiCallToReturnType,
  CallReturnData,
} from "./apiCalls";
export interface Rejection {
  type: "Rejection";
  reason: string;
}

export interface AddDelay {
  operation: "Add";
  valueSeconds: number;
}

export interface MultiplyDelay {
  operation: "Multiply";
  factor: number;
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

export interface RuleParams<C extends ApiCallNames> {
  name: string;
  call: C;
  threshold: (data: ApiCallToReturnType[C]) => boolean;
  action: Rejection | DelayAction;
}

export type PartialRuleParams<C extends ApiCallNames> = Omit<
  RuleParams<C>,
  "action"
>;

export interface CombinedRulesParams<T extends ReadonlyArray<ApiCallNames>> {
  // Essentially a readonly object type, i.e, [PartialRuleParams, PartialRuleParams, ...]
  partialRules: { readonly [C in keyof T]: PartialRuleParams<T[C]> };
  action: Rejection | DelayAction;
  applyIf: "Any" | "All";
}

export type CachedApiCallData = Partial<Record<ApiCallNames, CallReturnData>>;

export interface RuleLike {
  next: RuleLike | null;
  name: string;
  check: (
    deposit: ScreeningDepositRequest,
    cache: CachedApiCallData
  ) => Promise<Rejection | DelayAction | typeof ACTION_NOT_TRIGGERED>;
}

export class Rule<C extends ApiCallNames> implements RuleLike {
  public next: RuleLike | null = null;
  public readonly name: RuleParams<C>["name"];
  private threshold: RuleParams<C>["threshold"];
  private call: RuleParams<C>["call"];
  private action: RuleParams<C>["action"];

  constructor({ name, call, threshold, action }: RuleParams<C>) {
    this.name = name;
    this.call = call;
    this.threshold = threshold;
    this.action = action;
  }

  async check(
    deposit: ScreeningDepositRequest,
    cache: CachedApiCallData
  ): Promise<Rejection | DelayAction | typeof ACTION_NOT_TRIGGERED> {
    if (!cache[this.call]) {
      cache[this.call] = await API_CALL_MAP[this.call](deposit);
    }
    const data = cache[this.call] as ApiCallToReturnType[C];

    return this.threshold(data) ? this.action : ACTION_NOT_TRIGGERED;
  }
}

export class CompositeRule<T extends ReadonlyArray<ApiCallNames>>
  implements RuleLike
{
  public next: RuleLike | null = null;
  public readonly name: string;
  private partialRules: CombinedRulesParams<T>["partialRules"];
  private action: CombinedRulesParams<T>["action"];
  private predicateFn: "some" | "every"; // corresponds to Array.prototype.some and Array.prototype.every

  constructor(params: CombinedRulesParams<T>) {
    this.name = `Composite(${params.partialRules
      .map((r) => r.name)
      .join(", ")}):${params.applyIf}`;
    this.partialRules = params.partialRules;
    this.action = params.action;
    this.predicateFn = params.applyIf === "Any" ? "some" : "every";
  }

  async check(
    deposit: ScreeningDepositRequest,
    cache: CachedApiCallData
  ): Promise<Rejection | DelayAction | typeof ACTION_NOT_TRIGGERED> {
    const results = await Promise.all(
      this.partialRules.map(async (partial) => {
        if (!cache[partial.call]) {
          cache[partial.call] = await API_CALL_MAP[partial.call](deposit);
        }
        const data = cache[
          partial.call
        ] as ApiCallToReturnType[typeof partial.call];

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
  private readonly baseDelaySeconds;

  constructor({ baseDelaySeconds = 0 }: { baseDelaySeconds?: number } = {}) {
    this.baseDelaySeconds = baseDelaySeconds;
  }

  private _add(ruleLike: RuleLike) {
    if (!this.head) {
      this.head = ruleLike;
    } else {
      this.tail!.next = ruleLike;
    }
    this.tail = ruleLike;
  }

  add<C extends ApiCallNames>(ruleParams: RuleParams<C>): RuleSet {
    const rule = new Rule(ruleParams);
    this._add(rule);
    return this;
  }

  combineAndAdd<T extends ReadonlyArray<ApiCallNames>>(
    compositeParams: CombinedRulesParams<T>
  ): RuleSet {
    const composite = new CompositeRule(compositeParams);
    this._add(composite);
    return this;
  }

  async check(
    deposit: ScreeningDepositRequest,
    cache: CachedApiCallData = {}
  ): Promise<Rejection | Delay> {
    let delaySeconds = this.baseDelaySeconds;
    let currRule = this.head;
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
        delaySeconds = APPLY_DELAY_OPERATION[result.operation](
          delaySeconds,
          result.operation === "Add" ? result.valueSeconds : result.factor
        );
      }
      currRule = currRule.next;
    }
    console.log(`Screener execution for deposit:`, deposit, rulesLogList);
    return { type: "Delay", timeSeconds: delaySeconds };
  }
}
