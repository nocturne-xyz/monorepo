import { ScreeningDepositRequest } from "..";

export interface TrmAddressRiskIndicator {
  category: string;
  categoryId: string;
  categoryRiskScoreLevel: number;
  categoryRiskScoreLevelLabel:
    | null
    | "Unknown"
    | "Low"
    | "Medium"
    | "High"
    | "Severe";
  incomingVolumeUsd: string;
  outgoingVolumeUsd: string;
  riskType: "COUNTERPARTY" | "OWNERSHIP" | "INDIRECT";
  totalVolumeUsd: string;
}
export interface TrmData {
  externalId: string;
  addressIncomingVolumeUsd: string;
  addressOutgoingVolumeUsd: string;
  addressTotalVolumeUsd: string;
  addressRiskIndicators: TrmAddressRiskIndicator[];
}

export interface MisttrackRiskDetail {
  label: string;
  type: string;
  volume: number;
  address: string;
  percent: number;
}

export type MisttrackRiskItem =
  | "Malicious Address"
  | "Suspected Malicious Address"
  | "High-risk Tag Address"
  | "Medium-risk Tag Address"
  | "Mixer"
  | "Risk Exchange"
  | "Gambling"
  | "Involved Theft Activity"
  | "Involved Ransom Activity"
  | "Involved Phishing Activity"
  | "Interact With Malicious Address"
  | "Interact With Suspected Malicious Address"
  | "Interact With High-risk Tag Address"
  | "Interact With Medium-risk Tag Addresses";

type UnixTimestamp = number;

export interface MisttrackAddressOverviewData {
  balance: number;
  txs_count: number;
  first_seen: UnixTimestamp;
  last_seen: UnixTimestamp;
  total_received: number;
  total_spent: number;
  received_txs_count: number;
  spent_txs_count: number;
}
export interface MisttrackRiskScoreData {
  score: number;
  hacking_event: string;
  detail_list: MisttrackRiskItem[];
  risk_level: "Low" | "Moderate" | "High" | "Severe";
  risk_detail: MisttrackRiskDetail[];
}
type MisttrackData = MisttrackRiskScoreData | MisttrackAddressOverviewData;

export type MisttrackApiResponse<T extends MisttrackData> =
  | {
      success: false;
      msg: string;
    }
  | {
      success: true;
      data: T;
    };

export interface DummyTrmData {
  risk: number;
}
export interface DummyMisttrackData {
  misttrackRisk: number;
}

export type CallReturnData =
  | TrmData
  | MisttrackData
  | DummyTrmData
  | DummyMisttrackData
  | ScreeningDepositRequest;

const TRM_BASE_URL = "https://api.trmlabs.com/public/v2";
const MISTTRACK_BASE_URL = "https://openapi.misttrack.io/v1";
const TRM_API_KEY = ""; // TODO get from env, once we start paying for TRM
const MISTTRACK_API_KEY = "YourApiKey";

export const API_CALLS = {
  TRM_SCREENING_ADDRESSES: async (
    deposit: ScreeningDepositRequest
  ): Promise<TrmData> => {
    const body = JSON.stringify({
      address: deposit.spender,
      chain: "ethereum",
    });
    const response = await fetch(`${TRM_BASE_URL}/screening/addresses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " +
          Buffer.from(`${TRM_API_KEY}:${TRM_API_KEY}`).toString("base64"),
      },
      body,
    });
    const data = (await response.json())[0] as TrmData;
    console.log(data);
    return data;
  },
  // TODO deal with copypasta code
  MISTTRACK_ADDRESS_OVERVIEW: async (
    deposit: ScreeningDepositRequest,
    token = "ETH"
  ): Promise<MisttrackAddressOverviewData> => {
    const response = await fetch(
      `${MISTTRACK_BASE_URL}/address_overview?coin=${token}address=${deposit.spender}&api_key=${MISTTRACK_API_KEY}`
    );
    const misttrackResponse =
      (await response.json()) as MisttrackApiResponse<MisttrackAddressOverviewData>;
    if (!misttrackResponse.success) {
      throw new Error(
        `Call to misttrack failed with message: ${misttrackResponse.msg}`
      );
    }
    console.log(misttrackResponse.data);
    return misttrackResponse.data;
  },

  MISTTRACK_ADDRESS_RISK_SCORE: async (
    deposit: ScreeningDepositRequest,
    token = "ETH"
  ): Promise<MisttrackRiskScoreData> => {
    const response = await fetch(
      `${MISTTRACK_BASE_URL}/risk_score?coin=${token}&address=${deposit.spender}&api_key=${MISTTRACK_API_KEY}`
    );
    const misttrackResponse =
      (await response.json()) as MisttrackApiResponse<MisttrackRiskScoreData>;
    if (!misttrackResponse.success) {
      throw new Error(
        `Call to misttrack failed with message: ${misttrackResponse.msg}`
      );
    }
    console.log(misttrackResponse.data);
    return misttrackResponse.data;
  },
  DUMMY_TRM_SCREENING_ADDRESSES: async (deposit: ScreeningDepositRequest) => {
    console.log(deposit);
    return await Promise.resolve({ risk: 0.5 });
  },
  DUMMY_MISTTRACK_ADDRESS_RISK_SCORE: async (
    deposit: ScreeningDepositRequest
  ) => {
    console.log(deposit);
    return await Promise.resolve({ misttrackRisk: 0.5 });
  },
  NOOP: async (deposit: ScreeningDepositRequest) => deposit,
} as const;

export type ApiCallKeys = keyof typeof API_CALLS;
export type ApiMap = {
  [K in ApiCallKeys]: Awaited<ReturnType<(typeof API_CALLS)[K]>>;
};
