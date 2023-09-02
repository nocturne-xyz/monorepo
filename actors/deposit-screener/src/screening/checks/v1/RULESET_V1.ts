import { RuleSet } from "../RuleSet";
import { DummyMisttrackData, DummyTrmData } from "../apiCalls";

const TRM_RULE_1 = {
  name: "TRM_RULE_1",
  call: "DUMMY_TRM_SCREENING_ADDRESSES",
  threshold: (data: DummyTrmData) => data.risk > 0.5,
  action: { type: "Rejection", reason: "Risk is too high" },
} as const;
const TRM_RULE_2 = {
  name: "TRM_RULE_2",
  call: "DUMMY_TRM_SCREENING_ADDRESSES",
  threshold: (data: DummyTrmData) => data.risk > 0.25,
  action: { type: "Delay", operation: "Add", value: 1000 },
} as const;
const MISTTRACK_RULE_1 = {
  name: "MISTTRACK_RULE_1",
  call: "DUMMY_MISTTRACK_ADDRESS_RISK_SCORE",
  threshold: (data: DummyMisttrackData) => data.misttrackRisk > 0.5,
  action: { type: "Rejection", reason: "misttrackRisk is too high" },
} as const;

export const RULESET_V1 = new RuleSet()
  .add(TRM_RULE_1)
  .add(TRM_RULE_2)
  .add(MISTTRACK_RULE_1);
