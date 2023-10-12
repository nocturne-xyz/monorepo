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
export type MisttrackData =
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

export interface RequestData {
  requestInfo: RequestInfo;
  requestInit: RequestInit;
}

export function formatRequestData(
  callType: ApiCallNames,
  deposit: ScreeningDepositRequest,
  token = "ETH"
): RequestData {
  let url: string;
  let requestInit = {};
  if (callType === "TRM_SCREENING_ADDRESSES") {
    url = `${TRM_BASE_URL}/screening/addresses`;
    requestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " +
          Buffer.from(`${TRM_API_KEY}:${TRM_API_KEY}`).toString("base64"),
      },
      body: JSON.stringify([
        {
          address: deposit.spender,
          chain: "ethereum",
        },
      ]),
    };
  } else if (callType === "MISTTRACK_ADDRESS_OVERVIEW") {
    url = `${MISTTRACK_BASE_URL}/address_overview?coin=${token}&address=${deposit.spender}&api_key=${MISTTRACK_API_KEY}`;
  } else if (callType === "MISTTRACK_ADDRESS_LABELS") {
    url = `${MISTTRACK_BASE_URL}/address_labels?coin=${token}&address=${deposit.spender}&api_key=${MISTTRACK_API_KEY}`;
  } else {
    url = `${MISTTRACK_BASE_URL}/risk_score?coin=${token}&address=${deposit.spender}&api_key=${MISTTRACK_API_KEY}`;
  }

  return {
    requestInfo: url,
    requestInit,
  };
}

const TRM_RESPONSE_EXTRACTOR = (response: any): TrmData => {
  if (response["code"] === 400) {
    throw new Error(`Bad Request: ${JSON.stringify(response["errors"])}`);
  }
  return response[0] as TrmData;
};

const MISTTRACK_RESPONSE_EXTRACTOR = (response: any): MisttrackData => {
  if (!response.success) {
    throw new Error(`Call to misttrack failed with message: ${response.msg}`);
  }
  return response.data;
};

export const API_CALL_MAP = {
  TRM_SCREENING_ADDRESSES: async (
    deposit: ScreeningDepositRequest,
    cache: IORedis,
    cacheOptions: CachedFetchOptions = {}
  ): Promise<TrmData> => {
    const { requestInfo, requestInit } = formatRequestData(
      "TRM_SCREENING_ADDRESSES",
      deposit
    );

    console.log("Calling cachedFetchWithRetry");
    const response = await cachedFetchWithRetry(
      requestInfo,
      requestInit,
      cache,
      cacheOptions
    );

    console.log("response:", response);
    const responseJson = await response.json();
    return TRM_RESPONSE_EXTRACTOR(responseJson);
  },
  MISTTRACK_ADDRESS_OVERVIEW: async (
    deposit: ScreeningDepositRequest,
    cache: IORedis,
    cacheOptions: CachedFetchOptions = {}
  ): Promise<MisttrackAddressOverviewData> => {
    const { requestInfo, requestInit } = formatRequestData(
      "MISTTRACK_ADDRESS_OVERVIEW",
      deposit
    );
    const response = await cachedFetchWithRetry(
      requestInfo,
      requestInit,
      cache,
      cacheOptions
    );

    console.log("response:", response);
    const responseJson = await response.json();
    return MISTTRACK_RESPONSE_EXTRACTOR(
      responseJson
    ) as MisttrackAddressOverviewData;
  },

  MISTTRACK_ADDRESS_LABELS: async (
    deposit: ScreeningDepositRequest,
    cache: IORedis,
    cacheOptions: CachedFetchOptions = {},
    token = "ETH"
  ): Promise<MisttrackLabelsData> => {
    const { requestInfo, requestInit } = formatRequestData(
      "MISTTRACK_ADDRESS_LABELS",
      deposit
    );
    const response = await cachedFetchWithRetry(
      requestInfo,
      requestInit,
      cache,
      cacheOptions
    );

    console.log("response:", response);
    const responseJson = await response.json();
    return MISTTRACK_RESPONSE_EXTRACTOR(responseJson) as MisttrackLabelsData;
  },

  MISTTRACK_ADDRESS_RISK_SCORE: async (
    deposit: ScreeningDepositRequest,
    cache: IORedis,
    cacheOptions: CachedFetchOptions = {},
    token = "ETH"
  ): Promise<MisttrackRiskScoreData> => {
    const { requestInfo, requestInit } = formatRequestData(
      "MISTTRACK_ADDRESS_RISK_SCORE",
      deposit
    );
    const response = await cachedFetchWithRetry(
      requestInfo,
      requestInit,
      cache,
      cacheOptions
    );

    console.log("response:", response);
    const responseJson = await response.json();
    return MISTTRACK_RESPONSE_EXTRACTOR(responseJson) as MisttrackRiskScoreData;
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
