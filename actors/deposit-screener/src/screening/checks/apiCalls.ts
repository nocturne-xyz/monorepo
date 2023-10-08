import {
  CachedFetchOptions,
  cachedFetchWithRetry,
} from "@nocturne-xyz/offchain-utils";
import { ScreeningDepositRequest } from "..";
import IORedis from "ioredis";
import "dotenv/config";

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
  externalId: string | null;
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

export interface MisttrackLabelsData {
  label_list: string[];
}
type MisttrackData =
  | MisttrackRiskScoreData
  | MisttrackAddressOverviewData
  | MisttrackLabelsData;

export type MisttrackApiResponse<T extends MisttrackData> =
  | {
      success: false;
      msg: string;
    }
  | {
      success: true;
      data: T;
    };

const TRM_BASE_URL = "https://api.trmlabs.com/public/v2";
const MISTTRACK_BASE_URL = "https://openapi.misttrack.io/v1";
const TRM_API_KEY = process.env.TRM_API_KEY ?? "";
const MISTTRACK_API_KEY = process.env.MISTTRACK_API_KEY ?? "";

export const API_CALL_MAP = {
  TRM_SCREENING_ADDRESSES: async (
    deposit: ScreeningDepositRequest,
    cache: IORedis,
    cacheOptions: CachedFetchOptions = {}
  ): Promise<TrmData> => {
    const body = JSON.stringify([
      {
        address: deposit.spender,
        chain: "ethereum",
      },
    ]);
    const response = await cachedFetchWithRetry(
      `${TRM_BASE_URL}/screening/addresses`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " +
            Buffer.from(`${TRM_API_KEY}:${TRM_API_KEY}`).toString("base64"),
        },
        body,
      },
      cache,
      cacheOptions
    );

    const jsonResponse = (await response.json()) as any; // TODO: any cast
    if (jsonResponse["code"] === 400) {
      throw new Error(`Bad Request: ${JSON.stringify(jsonResponse["errors"])}`);
    }
    const data = jsonResponse[0] as TrmData;
    console.log(data);
    return data;
  },
  MISTTRACK_ADDRESS_OVERVIEW: async (
    deposit: ScreeningDepositRequest,
    cache: IORedis,
    cacheOptions: CachedFetchOptions = {}
  ): Promise<MisttrackAddressOverviewData> => {
    const token = "ETH";
    const response = await cachedFetchWithRetry(
      `${MISTTRACK_BASE_URL}/address_overview?coin=${token}&address=${deposit.spender}&api_key=${MISTTRACK_API_KEY}`,
      {},
      cache,
      cacheOptions
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

  MISTTRACK_ADDRESS_LABELS: async (
    deposit: ScreeningDepositRequest,
    cache: IORedis,
    cacheOptions: CachedFetchOptions = {},
    token = "ETH"
  ): Promise<MisttrackLabelsData> => {
    const response = await cachedFetchWithRetry(
      `${MISTTRACK_BASE_URL}/address_labels?coin=${token}&address=${deposit.spender}&api_key=${MISTTRACK_API_KEY}`,
      {},
      cache,
      cacheOptions
    );

    // check the content type before parsing json
    if (!response.headers.get("content-type")?.includes("application/json")) {
      console.log(await response.text());
      throw new Error(
        `Call to misttrack failed with message: ${response.statusText}`
      );
    }
    const misttrackResponse =
      (await response.json()) as MisttrackApiResponse<MisttrackLabelsData>;
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
    cache: IORedis,
    cacheOptions: CachedFetchOptions = {},
    token = "ETH"
  ): Promise<MisttrackRiskScoreData> => {
    const response = await cachedFetchWithRetry(
      `${MISTTRACK_BASE_URL}/risk_score?coin=${token}&address=${deposit.spender}&api_key=${MISTTRACK_API_KEY}`,
      {},
      cache,
      cacheOptions
    );

    // check the content type before parsing json
    if (!response.headers.get("content-type")?.includes("application/json")) {
      console.log(await response.text());
      throw new Error(
        `Call to misttrack failed with message: ${response.statusText}`
      );
    }
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
  IDENTITY: async (deposit: ScreeningDepositRequest) => deposit,
} as const;

export type ApiCallNames = keyof typeof API_CALL_MAP;
export type ApiCallReturnData =
  | TrmData
  | MisttrackData
  | ScreeningDepositRequest;
export type ApiCallToReturnType = {
  [K in ApiCallNames]: Awaited<ReturnType<(typeof API_CALL_MAP)[K]>>;
};
