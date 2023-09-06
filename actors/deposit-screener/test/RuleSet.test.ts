import { ScreeningDepositRequest } from "../src";
import { RuleParams, RuleSet } from "../src/screening/checks/RuleSet";
import { DummyTrmData } from "../src/screening/checks/apiCalls";

import { expect } from "chai";

const DELAY_50_ALWAYS: RuleParams<"NOOP"> = {
  name: "DELAY_50_ALWAYS",
  call: "NOOP",
  threshold: () => true,
  action: { type: "Delay", operation: "Add", value: 50 },
};

const REJECT_IF_RISK_OVER_POINT_5: RuleParams<"DUMMY_TRM_SCREENING_ADDRESSES"> =
  {
    name: "REJECT_IF_RISK_OVER_POINT_5",
    call: "DUMMY_TRM_SCREENING_ADDRESSES",
    threshold: (data: DummyTrmData) => {
      return data.risk > 0.5;
    },
    action: { type: "Rejection", reason: "This should not fire" },
  };

const REJECT_ALWAYS: RuleParams<"NOOP"> = {
  name: "REJECT_ALWAYS",
  call: "NOOP",
  threshold: () => true,
  action: {
    type: "Rejection",
    reason: "If included, this should make the deposit always reject",
  },
};

const DELAY_100_IF_RISK_IS_POINT_FIVE: RuleParams<"DUMMY_TRM_SCREENING_ADDRESSES"> =
  {
    name: "DELAY_100_IF_RISK_IS_POINT_FIVE",
    call: "DUMMY_TRM_SCREENING_ADDRESSES",
    threshold: (data: DummyTrmData) => {
      return data.risk === 0.5;
    },
    action: { type: "Delay", operation: "Add", value: 100 },
  };

const DELAY_BY_FACTOR_OF_2_IF_RISK_IS_POINT_FIVE: RuleParams<"DUMMY_TRM_SCREENING_ADDRESSES"> =
  {
    name: "DELAY_BY_FACTOR_OF_2_IF_RISK_IS_POINT_FIVE",
    call: "DUMMY_TRM_SCREENING_ADDRESSES",
    threshold: (data: DummyTrmData) => {
      return data.risk === 0.5;
    },
    action: { type: "Delay", operation: "Multiply", value: 2 },
  };

const DELAY_10000000_NEVER: RuleParams<"NOOP"> = {
  name: "DELAY_10000000_NEVER",
  call: "NOOP",
  threshold: () => false,
  action: { type: "Delay", operation: "Add", value: 10000000 },
};

const COMBINED_RULE_ANY = {
  partials: [
    {
      name: "NEVER_TRUE",
      call: "NOOP",
      threshold: () => false,
    },
    {
      name: "ALWAYS_TRUE",
      call: "NOOP",
      threshold: () => true,
    },
    {
      name: "SOMETIMES_TRUE",
      call: "NOOP",
      threshold: () => Math.random() > 0.5,
    },
  ],
  action: {
    type: "Delay",
    operation: "Add",
    value: 50,
  },
  applyIf: "Any",
} as const;

const COMBINED_RULE_ALL = {
  ...COMBINED_RULE_ANY,
  applyIf: "All",
} as const;

const DUMMY_DEPOSIT_REQUEST: ScreeningDepositRequest = {
  spender: "",
  assetAddr: "",
  value: 0n,
} as const;

describe("RuleSet", () => {
  it("should return a delay of 300 seconds", async () => {
    const DUMMY_RULESET = new RuleSet()
      .add(DELAY_50_ALWAYS)
      .add(REJECT_IF_RISK_OVER_POINT_5)
      .add(DELAY_100_IF_RISK_IS_POINT_FIVE)
      .add(DELAY_BY_FACTOR_OF_2_IF_RISK_IS_POINT_FIVE)
      .add(DELAY_10000000_NEVER);
    const result = await DUMMY_RULESET.check(DUMMY_DEPOSIT_REQUEST);
    expect(result).to.deep.equal({
      type: "Delay",
      timeSeconds: 300,
    });
  });

  it("should return a rejection", async () => {
    const DUMMY_RULESET = new RuleSet()
      .add(DELAY_50_ALWAYS)
      .add(REJECT_IF_RISK_OVER_POINT_5)
      .add(DELAY_100_IF_RISK_IS_POINT_FIVE)
      .add(REJECT_ALWAYS)
      .add(DELAY_BY_FACTOR_OF_2_IF_RISK_IS_POINT_FIVE)
      .add(DELAY_10000000_NEVER);

    const result = await DUMMY_RULESET.check(DUMMY_DEPOSIT_REQUEST);
    expect(result).to.deep.equal(REJECT_ALWAYS.action);
  });

  it("should take a combined rule requiring *any* to be true, and return a delay of 50", async () => {
    const DUMMY_RULESET = new RuleSet().combineAndAdd(COMBINED_RULE_ANY);

    const result = await DUMMY_RULESET.check(DUMMY_DEPOSIT_REQUEST);
    expect(result).to.deep.equal({
      type: "Delay",
      timeSeconds: 50,
    });
  });

  it("should take a combined rule requiring *all* to be true, and not apply the action", async () => {
    console.log("COMBINED_RULE_ALL", COMBINED_RULE_ALL);
    const DUMMY_RULESET = new RuleSet().combineAndAdd(COMBINED_RULE_ALL);

    const result = await DUMMY_RULESET.check(DUMMY_DEPOSIT_REQUEST);
    expect(result).to.deep.equal({
      type: "Delay",
      timeSeconds: 0,
    });
  });
});
