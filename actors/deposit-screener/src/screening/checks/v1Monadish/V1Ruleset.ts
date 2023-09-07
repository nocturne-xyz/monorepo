import { ScreeningDepositRequest } from "../..";
import { DelayIdentity } from "../../monadish";
import { Rule, RuleSet, RuleSetRejection, ThunkedAPICalls } from "../../monadish/RuleSet";

const TRM_SEVERE_OWNERSHIP_REJECT: Rule = {
  name: "TRM_SEVERE_OWNERSHIP_REJECT",
  check: async (deposit: ScreeningDepositRequest, api: ThunkedAPICalls) => {
    const trmData = await api.trmScreeningAddresses();
    const hasSevereRisk = trmData.addressRiskIndicators.some(
      (item) =>
        item.riskType === "OWNERSHIP" &&
        item.categoryRiskScoreLevelLabel === "Severe" &&
        Number(item.totalVolumeUsd) > 0
    );

    if (hasSevereRisk) {
      throw new RuleSetRejection("ownership exposure to severe risk categories > $0");
    }

    return DelayIdentity("deposit has no ownership exposure to severe risk categories > $0");
  },
};

const TRM_HIGH_COUNTERPARTY_REJECT: Rule = {
  name: "TRM_HIGH_COUNTERPARTY_REJECT",
  check: async (deposit: ScreeningDepositRequest, api: ThunkedAPICalls) => {
    const trmData = await api.trmScreeningAddresses();
    const hasHighRisk = trmData.addressRiskIndicators.some(
      (item) =>
        item.riskType === "COUNTERPARTY" &&
        item.categoryRiskScoreLevelLabel === "High" &&
        Number(item.totalVolumeUsd) > 5_000
    );

    if (hasHighRisk) {
      throw new RuleSetRejection("deposit has exposure to high risk counterparties > $5k");
    }

    return DelayIdentity("deposit has no exposure to high risk counterparties > $5k");
  },
};

const TRM_HIGH_INDIRECT_REJECT: Rule = {
  name: "TRM_HIGH_INDIRECT_REJECT",
  check: async (deposit: ScreeningDepositRequest, api: ThunkedAPICalls) => {
    const trmData = await api.trmScreeningAddresses();
    const hasHighRisk = trmData.addressRiskIndicators.some(
      (item) =>
        item.riskType === "INDIRECT" &&
        item.categoryRiskScoreLevelLabel === "High" &&
        Number(item.totalVolumeUsd) > 20_000
    );

    if (hasHighRisk) {
      throw new RuleSetRejection("deposit has exposure to high risk counterparties > $20k");
    }

    return DelayIdentity("deposit has no exposure to high risk counterparties > $20k");
  },
};

// ... more rules

export const V1Ruleset = new RuleSet()
  .add(TRM_SEVERE_OWNERSHIP_REJECT)
  .add(TRM_HIGH_COUNTERPARTY_REJECT)
  .add(TRM_HIGH_INDIRECT_REJECT);