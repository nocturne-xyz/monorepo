import { DepositRequest } from "@nocturne-xyz/core";

type Rejection = { type: "Rejection"; reason: string };
type Delay = { type: "Delay"; time: number };

type TrmData = {
  risk: number; // TODO, implement
};
type MisttrackData = {
  misttrackRisk: number; // TODO, implement
};

type Data = TrmData | MisttrackData;

const API_CALLS = {
  // {{TRM_URL}}/public/v2/screening/addresses
  TRM_SCREENING_ADDRESSES: async (deposit: DepositRequest) => {
    console.log(deposit);
    return await Promise.resolve({ risk: 0.5 });
  },
};

class Rule<T extends Data> {
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
    deposit: DepositRequest,
    cache: Record<string, Data>
  ): Promise<Rejection | Delay | undefined> {
    if (!cache[this.call]) {
      cache[this.call] = await API_CALLS[this.call](deposit);
    }
    const data = cache[this.call] as T;
    return this.threshold(data) ? this.action : undefined;
  }
}

class RuleSet {
  private head: Rule<any> | null = null;
  private tail: Rule<any> | null = null;
  private delay = 0;

  add<T extends Data>(rule: Rule<T>) {
    if (!this.head) {
      this.head = rule;
    } else {
      this.tail!.next = rule;
    }
    this.tail = rule;
    return this;
  }

  async check(deposit: DepositRequest): Promise<Rejection | Delay> {
    let currRule = this.head;
    const cache: Record<string, Data> = {};
    while (currRule !== null) {
      const result = await currRule.check(deposit, cache);
      if (result) {
        if (result.type === "Rejection") {
          return result;
        }
        this.delay += result.time;
      }
      currRule = currRule.next;
    }
    return { type: "Delay", time: this.delay };
  }
}

/**
 * USAGE
 */
// todo make facade for both TRM & Misttrack APIs
const TRM_RULE_1 = new Rule({
  // > $0 of ownership exposure to severe risk categories
  call: "TRM_SCREENING_ADDRESSES",
  threshold(data: TrmData) {
    return data.risk > 0.5; // TODO actually implement
  },
  action: { type: "Rejection", reason: "Risk is too high" },
});

const RULESET_V1 = new RuleSet().add(TRM_RULE_1);
