import { AssetTrait, StealthAddressTrait } from "@nocturne-xyz/core";
import { Rule, RuleSet } from "../src/screening/checks/RuleSet";
import { TrmData } from "../src/screening/checks/apiCalls";

(async () => {
  const DELAY_50_ALWAYS = new Rule({
    call: "TRM_SCREENING_ADDRESSES",
    threshold: () => {
      return true;
    },
    action: { type: "Delay", timeSeconds: 50 },
  });
  const REJECT_IF_RISK_OVER_POINT_5 = new Rule({
    call: "TRM_SCREENING_ADDRESSES",
    threshold: (data: TrmData) => {
      return data.risk > 0.5;
    },
    action: { type: "Rejection", reason: "This should not fire" },
  });
  //   const REJECT_ALWAYS = new Rule({
  //     call: "TRM_SCREENING_ADDRESSES",
  //     threshold: () => {
  //       return true;
  //     },
  //     action: {
  //       type: "Rejection",
  //       reason: "If included, this should make the deposit always reject",
  //     },
  //   });
  const DELAY_100_IF_RISK_IS_POINT_FIVE = new Rule({
    call: "TRM_SCREENING_ADDRESSES",
    threshold: (data: TrmData) => {
      return data.risk === 0.5;
    },
    action: { type: "Delay", timeSeconds: 100 },
  });
  const DELAY_10000000_NEVER = new Rule({
    call: "TRM_SCREENING_ADDRESSES",
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

  const DUMMY_DEPOSIT_REQUEST = {
    spender: "",
    encodedAsset: AssetTrait.encode({ assetType: 0, assetAddr: "", id: 0n }),
    value: 0n,
    depositAddr: StealthAddressTrait.compress({
      h1X: 0n,
      h1Y: 0n,
      h2X: 0n,
      h2Y: 0n,
    }),
    nonce: 0n,
    gasCompensation: 0n,
  };

  DUMMY_RULESET.check(DUMMY_DEPOSIT_REQUEST)
    .then((result) => {
      console.log(result);
    })
    .catch((err) => {
      console.log(err);
    });
})();
