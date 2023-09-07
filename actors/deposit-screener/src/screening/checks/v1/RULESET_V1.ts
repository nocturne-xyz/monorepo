import { CombinedRulesParams, RuleParams, RuleSet } from "../RuleSet";
import {
  MisttrackAddressOverviewData,
  MisttrackRiskItem,
  MisttrackRiskScoreData,
  TrmData,
} from "../apiCalls";
import { includesMixerUsage, isLessThanOneMonthAgo } from "./utils";

/**
 * Ruleset V1 Specification
 * https://www.notion.so/nocturnelabs/Compliance-Screener-Integration-3d95108850344f06a8fd78f8aa65ccfb
 */

const BASE_DELAY_SECONDS = 60 * 60 * 2; // 2 hours

// - TRM rejects if any of the following are true
//     - > $0 of ownership exposure to severe risk categories
//     - > $5k of counterparty exposure to high risk categories (NOTE that mixer is medium risk)
//     - > 20k of indirect exposure to high risk categories

const TRM_SEVERE_OWNERSHIP_REJECT: RuleParams<"TRM_SCREENING_ADDRESSES"> = {
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
};

const TRM_HIGH_COUNTERPARTY_REJECT: RuleParams<"TRM_SCREENING_ADDRESSES"> = {
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
};

const TRM_HIGH_INDIRECT_REJECT: RuleParams<"TRM_SCREENING_ADDRESSES"> = {
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
};

// - MistTrack rejects if
//     - Score > 80 AND phishing/theft has > 0 attributions
//         - If `risk_detail` contains keywords “theft” or “phish” or “rug” or “hack” or “exploit” or “scam”

const MISTTRACK_RISK_REJECT: RuleParams<"MISTTRACK_ADDRESS_RISK_SCORE"> = {
  name: "MISTTRACK_RISK_REJECT",
  call: "MISTTRACK_ADDRESS_RISK_SCORE",
  threshold: (data: MisttrackRiskScoreData) => {
    const banlistItems: MisttrackRiskItem[] = [
      "Involved Theft Activity",
      "Involved Phishing Activity",
      "Malicious Address",
    ];
    const detailListContainsBanlistItems = data.detail_list.some((item) =>
      banlistItems.includes(item)
    );
    const banlistWords = ["theft", "phish", "rug", "hack", "exploit", "scam"];
    const riskDetailContainsBanlistWords = data.risk_detail.some((item) =>
      banlistWords.some((word) => item.label.toLowerCase().includes(word))
    );
    return (
      data.score > 80 &&
      (detailListContainsBanlistItems || riskDetailContainsBanlistWords)
    );
  },
  action: {
    type: "Rejection",
    reason: "Score > 80 AND phishing/theft has > 0 attributions",
  },
};

// - Short wallet history (< 1 month activity) → 2x delay (4h)
//     - && high value wallet (> $300k balance) → 4x delay (8h)
//     - && origin from Tornado Cash post-sanctions → 4x delay (maxes out at 24h)

const shortWalletHistoryPartial = {
  name: "SHORT_WALLET_HISTORY_DELAY",
  call: "MISTTRACK_ADDRESS_OVERVIEW",
  threshold: (data: MisttrackAddressOverviewData) =>
    isLessThanOneMonthAgo(data.first_seen),
} as const;

const SHORT_WALLET_HISTORY_DELAY: RuleParams<"MISTTRACK_ADDRESS_OVERVIEW"> = {
  ...shortWalletHistoryPartial,
  action: {
    type: "Delay",
    operation: "Add",
    valueSeconds: 2 * BASE_DELAY_SECONDS,
  },
};

const SHORT_WALLET_HISTORY_AND_HIGH_VALUE_WALLET_DELAY: CombinedRulesParams<
  ["MISTTRACK_ADDRESS_OVERVIEW", "MISTTRACK_ADDRESS_OVERVIEW"]
> = {
  partials: [
    shortWalletHistoryPartial,
    {
      name: "SHORT_WALLET_HISTORY_AND_HIGH_VALUE_WALLET_DELAY",
      call: "MISTTRACK_ADDRESS_OVERVIEW",
      threshold: (data: MisttrackAddressOverviewData) => {
        const BALANCE_THRESHOLD = 300_000;
        return (
          isLessThanOneMonthAgo(data.first_seen) &&
          data.balance > BALANCE_THRESHOLD
        );
      },
    } as const,
  ],
  action: {
    type: "Delay",
    operation: "Add",
    valueSeconds: 2 * BASE_DELAY_SECONDS,
  },
  applyIf: "All",
};

const SHORT_WALLET_HISTORY_AND_MIXER_USAGE_DELAY: CombinedRulesParams<
  ["MISTTRACK_ADDRESS_OVERVIEW", "MISTTRACK_ADDRESS_RISK_SCORE"]
> = {
  partials: [
    shortWalletHistoryPartial,
    {
      name: "SHORT_WALLET_HISTORY_AND_MIXER_USAGE_DELAY",
      call: "MISTTRACK_ADDRESS_RISK_SCORE",
      threshold: (data: MisttrackRiskScoreData) => includesMixerUsage(data),
    },
  ],
  action: {
    type: "Delay",
    operation: "Add",
    valueSeconds: 2 * BASE_DELAY_SECONDS,
  },
  applyIf: "All",
};

// - Usage of mixer → 2x delay (4h)

const MIXER_USAGE_DELAY: RuleParams<"MISTTRACK_ADDRESS_RISK_SCORE"> = {
  name: "MIXER_USAGE_DELAY",
  call: "MISTTRACK_ADDRESS_RISK_SCORE",
  threshold: (data: MisttrackRiskScoreData) => includesMixerUsage(data),
  action: {
    type: "Delay",
    operation: "Add",
    valueSeconds: 2 * BASE_DELAY_SECONDS,
  },
};

// // - Large volume of deposits coming from same address (large multideposit) → 3x delay (6h)

// const LARGE_MULTIDEPOSIT_DELAY: RuleParams<"NOOP"> = {
//   name: "LARGE_MULTIDEPOSIT_DELAY",
//   call: "NOOP",
//   threshold: (deposit: ScreeningDepositRequest) => {
//     // TODO codeify large multideposit
//     return false;
//   },
//   action: { type: "Delay", operation: "Add", value: BASE_DELAY_SECONDS * 3 },
// };

// - Funds originated from Nocturne → 0.25*(base) + (2 * proportion of funds not previously coming from Nocturne)(base) delay (example, 100% of initial coming in: 30m + 2*2h = 4.5h)

// const FUNDS_ORIGINATING_FROM_NOCTURNE_DELAY: RuleParams<"NOOP"> = {
//   name: "FUNDS_ORIGINATING_FROM_NOCTURNE_DELAY",
//   call: "NOOP",
//   threshold: (deposit: ScreeningDepositRequest) => {
//     // TODO codeify funds originating from Nocturne
//     return false;
//   },
//   action: {
//     type: "Delay",
//     operation: "Multiply",
//     value: 0.25 * BASE_DELAY_SECONDS,
//   },
// };

export const RULESET_V1 = new RuleSet({
  baseDelaySeconds: BASE_DELAY_SECONDS,
})
  .add(TRM_SEVERE_OWNERSHIP_REJECT)
  .add(TRM_HIGH_COUNTERPARTY_REJECT)
  .add(TRM_HIGH_INDIRECT_REJECT)
  .add(MISTTRACK_RISK_REJECT)
  .add(SHORT_WALLET_HISTORY_DELAY)
  .combineAndAdd(SHORT_WALLET_HISTORY_AND_HIGH_VALUE_WALLET_DELAY)
  .combineAndAdd(SHORT_WALLET_HISTORY_AND_MIXER_USAGE_DELAY)
  .add(MIXER_USAGE_DELAY);
