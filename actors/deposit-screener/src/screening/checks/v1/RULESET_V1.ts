import { ScreeningDepositRequest } from "../..";
import { Rule, RuleSet } from "../RuleSet";
import {
  MisttrackAddressOverviewData,
  MisttrackRiskItem,
  MisttrackRiskScoreData,
  TrmData,
} from "../apiCalls";

/**
 * Ruleset V1 Specification
 * https://www.notion.so/nocturnelabs/Compliance-Screener-Integration-3d95108850344f06a8fd78f8aa65ccfb
 */

const BASE_DELAY_SECONDS = 60 * 60 * 2; // 2 hours

// - TRM rejects if any of the following are true
//     - > $0 of ownership exposure to severe risk categories
//     - > $5k of counterparty exposure to high risk categories (NOTE that mixer is medium risk)
//     - > 20k of indirect exposure to high risk categories

const TRM_SEVERE_OWNERSHIP_REJECT = Rule.create({
  name: "TRM_SEVERE_OWNERSHIP_REJECT",
  call: "TRM_SCREENING_ADDRESSES",
  threshold: (data: TrmData) => {
    return data.addressRiskIndicators.some(
      (item) =>
        item.riskType === "OWNERSHIP" &&
        item.categoryRiskScoreLevelLabel === "Severe" &&
        Number(item.totalVolumeUsd) > 0
    );
  },
  action: {
    type: "Rejection",
    reason: "Ownership exposure to severe risk categories > $0",
  },
});

const TRM_HIGH_COUNTERPARTY_REJECT = Rule.create({
  name: "TRM_HIGH_COUNTERPARTY_REJECT",
  call: "TRM_SCREENING_ADDRESSES",
  threshold: (data: TrmData) => {
    return data.addressRiskIndicators.some(
      (item) =>
        item.riskType === "COUNTERPARTY" &&
        item.categoryRiskScoreLevelLabel === "High" &&
        Number(item.totalVolumeUsd) > 5_000
    );
  },
  action: {
    type: "Rejection",
    reason: "Counterparty exposure to high risk categories > $5k",
  },
});

const TRM_HIGH_INDIRECT_REJECT = Rule.create({
  name: "TRM_HIGH_INDIRECT_REJECT",
  call: "TRM_SCREENING_ADDRESSES",
  threshold: (data: TrmData) => {
    return data.addressRiskIndicators.some(
      (item) =>
        item.riskType === "INDIRECT" &&
        item.categoryRiskScoreLevelLabel === "High" &&
        Number(item.totalVolumeUsd) > 20_000
    );
  },
  action: {
    type: "Rejection",
    reason: "Indirect exposure to high risk categories > $20k",
  },
});

// - MistTrack rejects if
//     - Score > 80 AND phishing/theft has > 0 attributions
//         - If `risk_detail` contains keywords “theft” or “phish” or “rug” or “hack” or “exploit” or “scam”

const MISTTRACK_RISK_REJECT = Rule.create({
  name: "MISTTRACK_RISK_REJECT",
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

// - Short wallet history (< 1 month activity) → 2x delay (4h)
//     - && high value wallet (> $300k balance) → 4x delay (8h)
//     - && origin from Tornado Cash post-sanctions → 4x delay (maxes out at 24h)

const SHORT_WALLET_HISTORY_DELAY = Rule.create({
  name: "SHORT_WALLET_HISTORY_DELAY",
  call: "MISTTRACK_ADDRESS_OVERVIEW",
  threshold: (data: MisttrackAddressOverviewData) => {
    // checks if first_seen is less than one month ago
    const now = Math.floor(Date.now() / 1000);
    const oneMonth = 60 * 60 * 24 * 30;
    return oneMonth > now - data.first_seen;
  },
  action: { type: "Delay", operation: "Add", value: BASE_DELAY_SECONDS * 2 },
});

const HIGH_VALUE_WALLET_DELAY = Rule.create({
  name: "HIGH_VALUE_WALLET_DELAY",
  call: "MISTTRACK_ADDRESS_OVERVIEW",
  threshold: (data: MisttrackAddressOverviewData) => {
    // checks if balance is greater than $300k
    const BALANCE_THRESHOLD = 300_000;
    return data.balance > BALANCE_THRESHOLD; // balance calculated in dollars
  },
  action: { type: "Delay", operation: "Add", value: BASE_DELAY_SECONDS * 4 },
});

// - Origin from Tornado Cash post-sanctions → 3x delay (6h)
//     - Check TRM for indirect or counterparty TC risk over certain amount (say 20k?)

const TC_POST_SANCTIONS_DELAY = Rule.create({
  name: "TC_POST_SANCTIONS_DELAY",
  call: "MISTTRACK_ADDRESS_RISK_SCORE",
  threshold: (data: MisttrackRiskScoreData) => {
    // TODO clarify delay calculation (add or multiply), and whether we intend to factor in origin from TC post-sanctions twice
    // also confirm how we want to define definitions in code
    return false;
  },
  action: { type: "Delay", operation: "Add", value: BASE_DELAY_SECONDS * 4 },
});

// - Large volume of deposits coming from same address (large multideposit) → 3x delay (6h)

const LARGE_MULTIDEP_DELAY = Rule.create({
  name: "LARGE_MULTIDEP_DELAY",
  call: "NOOP",
  threshold: (deposit: ScreeningDepositRequest) => {
    // TODO clarify how we want to define large multideposit
    return false;
  },
  action: { type: "Delay", operation: "Add", value: BASE_DELAY_SECONDS * 3 },
});

// - Funds originated from Nocturne → 0.25*(base) + (2 * proportion of funds not previously coming from Nocturne)(base) delay (example, 100% of initial coming in: 30m + 2*2h = 4.5h)

const FUNDS_ORIGINATING_FROM_NOCTURNE_DELAY = Rule.create({
  name: "FUNDS_ORIGINATING_FROM_NOCTURNE_DELAY",
  call: "NOOP",
  threshold: (deposit: ScreeningDepositRequest) => {
    // TODO how do we check if funds originated from Nocturne?
    return false;
  },
  action: { type: "Delay", operation: "Add", value: BASE_DELAY_SECONDS * 3 },
});

export const RULESET_V1 = new RuleSet({
  baseDelaySeconds: BASE_DELAY_SECONDS,
})
  .add(TRM_SEVERE_OWNERSHIP_REJECT)
  .add(TRM_HIGH_COUNTERPARTY_REJECT)
  .add(TRM_HIGH_INDIRECT_REJECT)
  .add(MISTTRACK_RISK_REJECT)
  .add(SHORT_WALLET_HISTORY_DELAY)
  .add(HIGH_VALUE_WALLET_DELAY)
  .add(TC_POST_SANCTIONS_DELAY)
  .add(LARGE_MULTIDEP_DELAY)
  .add(FUNDS_ORIGINATING_FROM_NOCTURNE_DELAY);
