import { Rule, RuleSet } from "../RuleSet";
import { DummyMisttrackData, DummyTrmData } from "../apiCalls";

const TRM_RULE_1 = new Rule({
  call: "DUMMY_TRM_SCREENING_ADDRESSES",
  threshold: (data: DummyTrmData) => data.risk > 0.5,
  action: { type: "Rejection", reason: "Risk is too high" },
});
const TRM_RULE_2 = new Rule({
  call: "DUMMY_TRM_SCREENING_ADDRESSES",
  threshold: (data: DummyTrmData) => data.risk > 0.25,
  action: { type: "Delay", timeSeconds: 1000 },
});
const MISTTRACK_RULE_1 = new Rule({
  call: "DUMMY_MISTTRACK_ADDRESS_RISK_SCORE",
  threshold: (data: DummyMisttrackData) => data.misttrackRisk > 0.5,
  action: { type: "Rejection", reason: "misttrackRisk is too high" },
});

export const RULESET_V1 = new RuleSet()
  .add(TRM_RULE_1)
  .add(TRM_RULE_2)
  .add(MISTTRACK_RULE_1);
