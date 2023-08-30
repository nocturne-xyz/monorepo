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

class Rule {
  next: Rule | null;
  threshold: (data: Data) => boolean;
  call: Thunk<Data>;
  action: Rejection | Delay;
  constructor({
    call,
    threshold,
    action,
  }: {
    call: (deposit: DepositRequest) => Promise<Data>;
    threshold: (data: Data) => boolean;
    action: Rejection | Delay;
  }) {
    this.next = null;
    this.call = thunk(call);
    this.threshold = threshold;
    this.action = action;
  }

  async check(deposit: DepositRequest): Promise<Rejection | Delay | undefined> {
    const data = await this.call(deposit); // TODO fix this up with thunk, won't work as is
    return this.threshold(data) ? this.action : undefined;
  }
}

class RuleSet {
  head: Rule | null = null;
  tail: Rule | null = null;
  delay: number = 0;

  constructor() {}

  add(rule: Rule) {
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
  call: () => Promise.resolve({ risk: 0.5 }),
  threshold(data: TrmData) {
    return data.risk > 0.5; // TODO actually implement
  },
  action: { type: "Rejection", reason: "Risk is too high" },
});
// > $0 of ownership exposure to severe risk categories

const RULESET_V1 = new RuleSet().add(TRM_RULE_1);
