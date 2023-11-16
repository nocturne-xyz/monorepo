import { CachedFetchOptions } from "@nocturne-xyz/offchain-utils";
import IORedis from "ioredis";
import { Logger } from "winston";
import { ScreeningDepositRequest } from "..";
import {
  API_CALL_MAP,
  ApiCallNames,
  ApiCallReturnData,
  ApiCallToReturnType,
} from "./apiCalls";

export interface Rejection {
  type: "Rejection";
  reason: string;
}

export interface Delay {
  type: "Delay";
  timeSeconds: number;
}

export function isRejection(obj: Rejection | Delay): obj is Rejection {
  return obj.type === "Rejection";
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

export type CachedApiCallData = Partial<
  Record<ApiCallNames, ApiCallReturnData>
>;

export interface RuleLike {
  next: RuleLike | null;
  name: string;
  check: (
    deposit: ScreeningDepositRequest,
    cachedFetchOptions: CachedFetchOptions
  ) => Promise<Rejection | DelayAction | typeof ACTION_NOT_TRIGGERED>;
}

export class Rule<C extends ApiCallNames> implements RuleLike {
  public next: RuleLike | null = null;
  public readonly name: RuleParams<C>["name"];
  private threshold: RuleParams<C>["threshold"];
  private call: RuleParams<C>["call"];
  private action: RuleParams<C>["action"];
  private cache: IORedis;

  constructor(
    { name, call, threshold, action }: RuleParams<C>,
    cache: IORedis
  ) {
    this.name = name;
    this.call = call;
    this.threshold = threshold;
    this.action = action;
    this.cache = cache;
  }

  async check(
    deposit: ScreeningDepositRequest,
    cachedFetchOptions: CachedFetchOptions
  ): Promise<Rejection | DelayAction | typeof ACTION_NOT_TRIGGERED> {
    const data = (await API_CALL_MAP[this.call](
      deposit,
      this.cache,
      cachedFetchOptions
    )) as ApiCallToReturnType[C];

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
  private cache: IORedis;

  constructor(params: CombinedRulesParams<T>, cache: IORedis) {
    this.name = `Composite(${params.partialRules
      .map((r) => r.name)
      .join(", ")}):${params.applyIf}`;
    this.partialRules = params.partialRules;
    this.action = params.action;
    this.predicateFn = params.applyIf === "Any" ? "some" : "every";
    this.cache = cache;
  }

  async check(
    deposit: ScreeningDepositRequest,
    cachedFetchOptions: CachedFetchOptions = {}
  ): Promise<Rejection | DelayAction | typeof ACTION_NOT_TRIGGERED> {
    const results = await Promise.all(
      this.partialRules.map(async (partial) => {
        const data = (await API_CALL_MAP[partial.call](
          deposit,
          this.cache,
          cachedFetchOptions
        )) as ApiCallToReturnType[typeof partial.call];

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
  private cache: IORedis;
  private logger: Logger;

  constructor(
    { baseDelaySeconds }: { baseDelaySeconds: number },
    cache: IORedis,
    logger: Logger
  ) {
    this.baseDelaySeconds = baseDelaySeconds;
    this.cache = cache;
    this.logger = logger;
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
    const rule = new Rule(ruleParams, this.cache);
    this._add(rule);
    return this;
  }

  combineAndAdd<T extends ReadonlyArray<ApiCallNames>>(
    compositeParams: CombinedRulesParams<T>
  ): RuleSet {
    const composite = new CompositeRule(compositeParams, this.cache);
    this._add(composite);
    return this;
  }

  async check(
    deposit: ScreeningDepositRequest,
    cachedFetchOptions: CachedFetchOptions = {}
  ): Promise<Rejection | Delay> {
    let delaySeconds = this.baseDelaySeconds;
    let currRule = this.head;
    const rulesLogList: {
      ruleName: string;
      result: Awaited<ReturnType<RuleLike["check"]>>;
    }[] = [];

    while (currRule !== null) {
      const result = await currRule.check(deposit, cachedFetchOptions);
      rulesLogList.push({
        ruleName: currRule.name,
        result,
      });
      if (result.type === "Rejection") {
        this.logger.info(`Screener execution for deposit:`, {
          deposit: { ...deposit },
          results: { ...toLoggable(rulesLogList) },
        });
        return result;
      } else if (result.type === "Delay") {
        delaySeconds = APPLY_DELAY_OPERATION[result.operation](
          delaySeconds,
          result.operation === "Add" ? result.valueSeconds : result.factor
        );
      }
      currRule = currRule.next;
    }
    this.logger.info(`Screener execution for deposit:`, {
      deposit: { ...deposit },
      results: { ...toLoggable(rulesLogList) },
    });
    return { type: "Delay", timeSeconds: delaySeconds };
  }
}

const toLoggable = (
  rulesLogList: {
    ruleName: string;
    result: Awaited<ReturnType<RuleLike["check"]>>;
  }[]
): Record<string, Rejection | DelayAction | typeof ACTION_NOT_TRIGGERED> => {
  return rulesLogList.reduce((acc, { ruleName, result }) => {
    acc[ruleName] = result;
    return acc;
  }, {} as Record<string, Awaited<ReturnType<RuleLike["check"]>>>);
};
