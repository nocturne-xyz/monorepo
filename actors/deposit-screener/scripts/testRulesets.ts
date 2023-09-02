import { ScreeningDepositRequest } from "../src";
import { RuleSet } from "../src/screening/checks/RuleSet";
import { DummyTrmData } from "../src/screening/checks/apiCalls";

const DELAY_50_ALWAYS = {
  name: "DELAY_50_ALWAYS",
  call: "DUMMY_TRM_SCREENING_ADDRESSES",
  threshold: () => {
    return true;
  },
  action: { type: "Delay", operation: "Add", value: 50 },
} as const;

const REJECT_IF_RISK_OVER_POINT_5 = {
  name: "REJECT_IF_RISK_OVER_POINT_5",
  call: "DUMMY_TRM_SCREENING_ADDRESSES",
  threshold: (data: DummyTrmData) => {
    return data.risk > 0.5;
  },
  action: { type: "Rejection", reason: "This should not fire" },
} as const;

const REJECT_ALWAYS = {
  name: "REJECT_ALWAYS",
  call: "DUMMY_TRM_SCREENING_ADDRESSES",
  threshold: () => {
    return true;
  },
  action: {
    type: "Rejection",
    reason: "If included, this should make the deposit always reject",
  },
} as const;

const DELAY_100_IF_RISK_IS_POINT_FIVE = {
  name: "DELAY_100_IF_RISK_IS_POINT_FIVE",
  call: "DUMMY_TRM_SCREENING_ADDRESSES",
  threshold: (data: DummyTrmData) => {
    return data.risk === 0.5;
  },
  action: { type: "Delay", operation: "Add", value: 100 },
} as const;

const DELAY_BY_FACTOR_OF_2_IF_RISK_IS_POINT_FIVE = {
  name: "DELAY_BY_FACTOR_OF_2_IF_RISK_IS_POINT_FIVE",
  call: "DUMMY_TRM_SCREENING_ADDRESSES",
  threshold: (data: DummyTrmData) => {
    return data.risk === 0.5;
  },
  action: { type: "Delay", operation: "Multiply", value: 2 },
} as const;

const DELAY_10000000_NEVER = {
  name: "DELAY_10000000_NEVER",
  call: "DUMMY_TRM_SCREENING_ADDRESSES",
  threshold: () => {
    return false;
  },
  action: { type: "Delay", operation: "Add", value: 10000000 },
} as const;

(async () => {
  const DUMMY_RULESET = new RuleSet()
    .add(DELAY_50_ALWAYS)
    .add(REJECT_IF_RISK_OVER_POINT_5)
    .add(DELAY_100_IF_RISK_IS_POINT_FIVE)
    .add(DELAY_BY_FACTOR_OF_2_IF_RISK_IS_POINT_FIVE)
    .add(DELAY_10000000_NEVER);

  const DUMMY_RULESET_2 = new RuleSet()
    .add(DELAY_50_ALWAYS)
    .add(REJECT_IF_RISK_OVER_POINT_5)
    .add(DELAY_100_IF_RISK_IS_POINT_FIVE)
    .add(REJECT_ALWAYS)
    .add(DELAY_BY_FACTOR_OF_2_IF_RISK_IS_POINT_FIVE)
    .add(DELAY_10000000_NEVER);

  const DUMMY_DEPOSIT_REQUEST: ScreeningDepositRequest = {
    spender: "",
    assetAddr: "",
    value: 0n,
  };

  DUMMY_RULESET.check(DUMMY_DEPOSIT_REQUEST)
    .then((result) => {
      console.log("———————————First Test———————————");
      console.log("Expected result: ", {
        type: "Delay",
        timeSeconds: 300,
      });
      console.log("Actual result: ", result);
      console.log("————————————————————————————————");
    })
    .then(() => {
      DUMMY_RULESET_2.check(DUMMY_DEPOSIT_REQUEST).then((result) => {
        console.log("———————————Second Test———————————");
        // @ts-ignore
        console.log("Expected result: ", REJECT_ALWAYS.action);
        console.log("Actual result: ", result);
      });
    })
    .catch((err) => {
      console.log(err);
    });
})();
