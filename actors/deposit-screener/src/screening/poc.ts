import { DepositRequest } from "@nocturne-xyz/core";

type Rejection = { type: "Rejection"; reason: string };
type Delay = { type: "Delay"; timeSeconds: number };

type TrmData = {
  risk: number; // TODO, use vals from response
};
type MisttrackData = {
  misttrackRisk: number;
};

type Data = TrmData | MisttrackData;

const API_CALLS = {
  // {{TRM_URL}}/public/v2/screening/addresses
  TRM_SCREENING_ADDRESSES: async (deposit: DepositRequest) => {
    console.log(deposit);
    return await Promise.resolve({ risk: 0.5 });
  },
  // {{MISTTRACK_BASE_URL}}/risk_score
  MISTTRACK_ADDRESS_RISK_SCORE: async (deposit: DepositRequest) => {
    console.log(deposit);
    return await Promise.resolve({ misttrackRisk: 0.5 });
  },
} as const;

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
        this.delay += result.timeSeconds;
      }
      currRule = currRule.next;
    }
    return { type: "Delay", timeSeconds: this.delay };
  }
}

/**
 * SETUP
 */
// todo make facade for both TRM & Misttrack APIs
const TRM_RULE_1 = new Rule({
  call: "TRM_SCREENING_ADDRESSES",
  threshold: (data: TrmData) => data.risk > 0.5,
  action: { type: "Rejection", reason: "Risk is too high" },
});
const TRM_RULE_2 = new Rule({
  call: "TRM_SCREENING_ADDRESSES",
  threshold: (data: TrmData) => data.risk > 0.25,
  action: { type: "Delay", timeSeconds: 1000 },
});
const MISTTRACK_RULE_1 = new Rule({
  call: "MISTTRACK_ADDRESS_RISK_SCORE",
  threshold: (data: MisttrackData) => data.misttrackRisk > 0.5,
  action: { type: "Rejection", reason: "misttrackRisk is too high" },
});

const RULESET_V1 = new RuleSet()
  .add(TRM_RULE_1)
  .add(TRM_RULE_2)
  .add(MISTTRACK_RULE_1);

/**
 * USAGE
 */
const DUMMY_DEPOSIT_REQUEST = {} as DepositRequest;
RULESET_V1.check(DUMMY_DEPOSIT_REQUEST)
  .then((result) => {
    console.log(result);
  })
  .catch((err) => {
    console.log(err);
  });
