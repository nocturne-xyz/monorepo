import { Logger } from "winston";
import { CombinedRulesParams, RuleParams, RuleSet } from "../RuleSet";
import {
  MisttrackAddressOverviewData,
  MisttrackLabelsData,
  MisttrackRiskItem,
  MisttrackRiskScoreData,
  TrmData,
} from "../apiCalls";
import {
  includesMixerUsage,
  isCreatedAfterTornadoCashSanction,
  isLessThanOneMonthAgo,
} from "./utils";
import IORedis from "ioredis";

/**
 * Ruleset V1 Specification
 * https://www.notion.so/nocturnelabs/Compliance-Screener-Integration-3d95108850344f06a8fd78f8aa65ccfb
 */

const BASE_DELAY_SECONDS = 60 * 60 * 2; // 2 hours

// - TRM rejects if any of the following are true
//     - > $0 of ownership exposure to severe risk categories
//     - > $15k of ownership exposure to high risk categories
//     - > $30k of counterparty exposure to severe risk categories
//     - > $50k of counterparty exposure to high risk categories (NOTE that mixer is medium risk)
//     - > $300k of indirect exposure to high risk categories
//     - > 50% of funds owned by wallet from mixer

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

const TRM_HIGH_OWNERSHIP_REJECT: RuleParams<"TRM_SCREENING_ADDRESSES"> = {
  name: "TRM_HIGH_OWNERSHIP_REJECT",
  call: "TRM_SCREENING_ADDRESSES",
  threshold: (data: TrmData) => {
    const totalHighOwnership = data.addressRiskIndicators.reduce(
      (acc, item) =>
        item.riskType === "OWNERSHIP" &&
        item.categoryRiskScoreLevelLabel === "High"
          ? acc + Number(item.incomingVolumeUsd)
          : acc,
      0
    );

    return totalHighOwnership > 15_000;
  },
  action: {
    type: "Rejection",
    reason: "Ownership exposure to high risk categories > $0",
  },
};

const noPositiveLabelsPartial = {
  name: "NO_POSITIVE_LABELS_PARTIAL",
  call: "MISTTRACK_ADDRESS_LABELS",
  threshold: (data: MisttrackLabelsData) => {
    for (const label of data.label_list) {
      if (label === "DeFi Whale") {
        return false;
      } else if (label.startsWith("Twitter:")) {
        return false;
      }
    }

    return true;
  },
} as const;

const TRM_SEVERE_COUNTERPARTY_REJECT: CombinedRulesParams<
  ["TRM_SCREENING_ADDRESSES", "MISTTRACK_ADDRESS_LABELS"]
> = {
  partialRules: [
    {
      name: "TRM_SEVERE_COUNTERPARTY_REJECT",
      call: "TRM_SCREENING_ADDRESSES",
      threshold: (data: TrmData) => {
        return data.addressRiskIndicators.some(
          (item) =>
            item.riskType === "COUNTERPARTY" &&
            item.categoryRiskScoreLevelLabel === "Severe" &&
            Number(item.totalVolumeUsd) > 30_000
        );
      },
    },
    noPositiveLabelsPartial,
  ],
  action: {
    type: "Rejection",
    reason: "Counterparty exposure to severe risk categories > $30k",
  },
  applyIf: "All",
};

const TRM_HIGH_COUNTERPARTY_REJECT: CombinedRulesParams<
  ["TRM_SCREENING_ADDRESSES", "MISTTRACK_ADDRESS_LABELS"]
> = {
  partialRules: [
    {
      name: "TRM_HIGH_COUNTERPARTY_REJECT",
      call: "TRM_SCREENING_ADDRESSES",
      threshold: (data: TrmData) => {
        return data.addressRiskIndicators.some(
          (item) =>
            item.riskType === "COUNTERPARTY" &&
            item.categoryRiskScoreLevelLabel === "High" &&
            Number(item.totalVolumeUsd) > 50_000
        );
      },
    },
    noPositiveLabelsPartial,
  ],
  action: {
    type: "Rejection",
    reason: "Counterparty exposure to high risk categories > $50k",
  },
  applyIf: "All",
};

const TRM_HIGH_INDIRECT_REJECT: CombinedRulesParams<
  ["TRM_SCREENING_ADDRESSES", "MISTTRACK_ADDRESS_LABELS"]
> = {
  partialRules: [
    {
      name: "TRM_HIGH_INDIRECT_REJECT",
      call: "TRM_SCREENING_ADDRESSES",
      threshold: (data: TrmData) => {
        return data.addressRiskIndicators.some(
          (item) =>
            item.riskType === "INDIRECT" &&
            item.categoryRiskScoreLevelLabel === "High" &&
            Number(item.totalVolumeUsd) > 300_000
        );
      },
    },
    noPositiveLabelsPartial,
  ],
  applyIf: "All",
  action: {
    type: "Rejection",
    reason: "Indirect exposure to high risk categories > $300k",
  },
};

const walletCreatedAfterTornadoSanctionPartial = {
  name: "SHORT_WALLET_HISTORY_DELAY",
  call: "MISTTRACK_ADDRESS_OVERVIEW",
  threshold: (data: MisttrackAddressOverviewData) =>
    isCreatedAfterTornadoCashSanction(data.first_seen),
} as const;

const TRM_HIGH_MIXER_REJECT: CombinedRulesParams<
  ["MISTTRACK_ADDRESS_OVERVIEW", "TRM_SCREENING_ADDRESSES"]
> = {
  partialRules: [
    walletCreatedAfterTornadoSanctionPartial,
    {
      name: "TRM_HIGH_MIXER_REJECT",
      call: "TRM_SCREENING_ADDRESSES",
      threshold: (data: TrmData) => {
        const totalMixerIncoming = data.addressRiskIndicators.reduce(
          (acc, item) =>
            (item.category === "Mixer" && item.riskType === "COUNTERPARTY") ||
            (item.category === "Sanctions" && item.riskType === "COUNTERPARTY")
              ? acc + Number(item.incomingVolumeUsd)
              : acc,
          0
        );

        const percentageIncomingFromMixer =
          totalMixerIncoming / Number(data.addressIncomingVolumeUsd);
        return percentageIncomingFromMixer > 0.5;
      },
    },
  ],
  applyIf: "All",
  action: {
    type: "Rejection",
    reason: "Counterparty exposure to mixer > 50%",
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
    const banlistWords = [
      "theft",
      "phish",
      "rug",
      "hack",
      "exploit",
      "scam",
      "attacker",
    ];
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
  partialRules: [
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
  partialRules: [
    shortWalletHistoryPartial,
    {
      name: "MIXER_USAGE_DELAY",
      call: "MISTTRACK_ADDRESS_RISK_SCORE",
      threshold: (data) => includesMixerUsage(data),
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

// const LARGE_MULTIDEPOSIT_DELAY: RuleParams<"IDENTITY"> = {
//   name: "LARGE_MULTIDEPOSIT_DELAY",
//   call: "IDENTITY",
//   threshold: (deposit: ScreeningDepositRequest) => {
//     // TODO codeify large multideposit
//     return false;
//   },
//   action: { type: "Delay", operation: "Add", value: BASE_DELAY_SECONDS * 3 },
// };

// - Funds originated from Nocturne → 0.25*(base) + (2 * proportion of funds not previously coming from Nocturne)(base) delay (example, 100% of initial coming in: 30m + 2*2h = 4.5h)

// const FUNDS_ORIGINATING_FROM_NOCTURNE_DELAY: RuleParams<"IDENTITY"> = {
//   name: "FUNDS_ORIGINATING_FROM_NOCTURNE_DELAY",
//   call: "IDENTITY",
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

export const RULESET_V1 = (redis: IORedis, logger: Logger): RuleSet => {
  return new RuleSet(
    {
      baseDelaySeconds: BASE_DELAY_SECONDS,
    },
    redis,
    logger
  )
    .add(TRM_SEVERE_OWNERSHIP_REJECT)
    .add(TRM_HIGH_OWNERSHIP_REJECT)
    .combineAndAdd(TRM_SEVERE_COUNTERPARTY_REJECT)
    .combineAndAdd(TRM_HIGH_MIXER_REJECT)
    .combineAndAdd(TRM_HIGH_COUNTERPARTY_REJECT)
    .combineAndAdd(TRM_HIGH_INDIRECT_REJECT)
    .add(MISTTRACK_RISK_REJECT)
    .add(SHORT_WALLET_HISTORY_DELAY)
    .combineAndAdd(SHORT_WALLET_HISTORY_AND_HIGH_VALUE_WALLET_DELAY)
    .combineAndAdd(SHORT_WALLET_HISTORY_AND_MIXER_USAGE_DELAY)
    .add(MIXER_USAGE_DELAY);
};
