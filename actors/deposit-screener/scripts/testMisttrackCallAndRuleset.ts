import { ScreeningDepositRequest } from "../src";
import { Rule, RuleSet } from "../src/screening/checks/RuleSet";
import {
  MisttrackRiskItem,
  MisttrackRiskScoreData,
} from "../src/screening/checks/apiCalls";

const SAMPLE_DEPOSIT_REQUEST: ScreeningDepositRequest = {
  spender: "0x86738d21db9a2ccc9747b2e374fd1a500f6eeb50",
  assetAddr: "",
  value: 0n,
};

const MISTTRACK_REJECT_SCORE_OVER_80_AND_PHISHING_THEFT_NONZERO = Rule.create({
  name: "MISTTRACK_REJECT_SCORE_OVER_80_AND_PHISHING_THEFT_NONZERO",
  call: "MISTTRACK_ADDRESS_RISK_SCORE",
  threshold: (data: MisttrackRiskScoreData) => {
    const banlist: MisttrackRiskItem[] = [
      "Involved Theft Activity",
      "Involved Phishing Activity",
      "Involved Ransom Activity",
      "Malicious Address",
      "Interact With Malicious Address",
    ];
    const riskDetailContainsBanlistWords = data.detail_list.some((item) =>
      banlist.includes(item)
    );
    return data.score > 80 && riskDetailContainsBanlistWords;
  },
  action: {
    type: "Rejection",
    reason: "Score > 80 AND phishing/theft has > 0 attributions",
  },
});

(async () => {
  const DUMMY_RULESET = new RuleSet().add(
    MISTTRACK_REJECT_SCORE_OVER_80_AND_PHISHING_THEFT_NONZERO
  );

  DUMMY_RULESET.check(SAMPLE_DEPOSIT_REQUEST)
    .then((result) => {
      console.log("———————————First Test———————————");
      console.log("Expected result: ", {
        type: "Rejection",
        reason: "Score > 80 AND phishing/theft has > 0 attributions",
      });
      console.log("Actual result: ", result);
      console.log("————————————————————————————————");
    })
    .catch((err) => {
      console.log(err);
    });
})();
