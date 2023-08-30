import { DepositRequest, Thunk, thunk } from "@nocturne-xyz/core";

type Rejection = { type: "Rejection"; reason: string };
type Delay = { type: "Delay"; time: number };

type TrmData = {
  risk: number; // TODO, implement
};
type MisttrackData = {
  misttrackRisk: number; // TODO, implement
};

type Data = TrmData | MisttrackData;

class Rule<T extends Data> {
  next: Rule<any> | null;
  threshold: (data: T) => boolean;
  call: Thunk<T, [DepositRequest]>;
  action: Rejection | Delay;
  constructor({
    call,
    threshold,
    action,
  }: {
    call: (deposit: DepositRequest) => Promise<T>;
    threshold: (data: T) => boolean;
    action: Rejection | Delay;
  }) {
    this.next = null;
    this.call = thunk(call);
    this.threshold = threshold;
    this.action = action;
  }

  async check(deposit: DepositRequest): Promise<Rejection | Delay | undefined> {
    const data = await this.call(deposit);
    return this.threshold(data) ? this.action : undefined;
  }
}

class RuleSet {
  head: Rule<any> | null = null;
  tail: Rule<any> | null = null;
  delay = 0;

  constructor() {}

  add<T extends Data>(rule: Rule<T>) {
    if (!this.head) {
      this.head = rule;
    } else {
      this.tail!.next = rule;
    }
    this.tail = rule;
  }

  async check(deposit: DepositRequest): Promise<Rejection | Delay> {
    // todo iterate through calls, dedup
    let currRule = this.head;
    while (currRule !== null) {
      const result = await currRule.check(deposit);
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
// todo reuse calls to apis, by extracting it out and making properties it returns usable by actionthreshold
const TRM_RULE_1 = new Rule({
  // > $0 of ownership exposure to severe risk categories
  call: (deposit: DepositRequest) => Promise.resolve({ risk: 0.5 }),
  threshold(data: TrmData) {
    return data.risk > 0.5; // TODO actually implement
  },
  action: { type: "Rejection", reason: "Risk is too high" },
});

const RULESET_V1 = new RuleSet().add(TRM_RULE_1);
