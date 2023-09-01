import { ScreeningDepositRequest } from "../src";
import { Rule, RuleSet } from "../src/screening/checks/RuleSet";
import { DummyTrmData } from "../src/screening/checks/apiCalls";

(async () => {
  const DELAY_50_ALWAYS = new Rule({
    call: "DUMMY_TRM_SCREENING_ADDRESSES",
    threshold: () => {
      return true;
    },
    action: { type: "Delay", timeSeconds: 50 },
  });
  const REJECT_IF_RISK_OVER_POINT_5 = new Rule({
    call: "DUMMY_TRM_SCREENING_ADDRESSES",
    threshold: (data: DummyTrmData) => {
      return data.risk > 0.5;
    },
    action: { type: "Rejection", reason: "This should not fire" },
  });
  //   const REJECT_ALWAYS = new Rule({
  //     call: "DUMMY_TRM_SCREENING_ADDRESSES",
  //     threshold: () => {
  //       return true;
  //     },
  //     action: {
  //       type: "Rejection",
  //       reason: "If included, this should make the deposit always reject",
  //     },
  //   });
  const DELAY_100_IF_RISK_IS_POINT_FIVE = new Rule({
    call: "DUMMY_TRM_SCREENING_ADDRESSES",
    threshold: (data: DummyTrmData) => {
      return data.risk === 0.5;
    },
    action: { type: "Delay", timeSeconds: 100 },
  });
  const DELAY_10000000_NEVER = new Rule({
    call: "DUMMY_TRM_SCREENING_ADDRESSES",
    threshold: () => {
      return false;
    },
    action: { type: "Delay", timeSeconds: 10000000 },
  });
  const DUMMY_RULESET = new RuleSet()
    .add(DELAY_50_ALWAYS)
    .add(REJECT_IF_RISK_OVER_POINT_5)
    // .add(REJECT_ALWAYS)
    .add(DELAY_100_IF_RISK_IS_POINT_FIVE)
    .add(DELAY_10000000_NEVER);

  const DUMMY_DEPOSIT_REQUEST: ScreeningDepositRequest = {
    spender: "",
    assetAddr: "",
    value: 0n,
  };

  DUMMY_RULESET.check(DUMMY_DEPOSIT_REQUEST)
    .then((result) => {
      console.log(result);
    })
    .catch((err) => {
      console.log(err);
    });
})();
