import { ScreeningDepositRequest } from "..";

export interface AddressRiskIndicator {
  category: string;
  categoryId: string;
  categoryRiskScoreLevel: number;
  categoryRiskScoreLevelLabel: string;
  incomingVolumeUsd: string;
  outgoingVolumeUsd: string;
  riskType: string;
  totalVolumeUsd: string;
}
export interface TrmData {
  externalId: string;
  addressIncomingVolumeUsd: string;
  addressOutgoingVolumeUsd: string;
  addressTotalVolumeUsd: string;
  addressRiskIndicators: AddressRiskIndicator[];
}

export interface MisttrackData {
  balance: number;
  txs_count: number;
  first_seen: number;
  last_seen: number;
  total_received: number;
  total_spent: number;
  received_txs_count: number;
  spent_txs_count: number;
}

export interface DummyTrmData {
  risk: number;
}
export interface DummyMisttrackData {
  misttrackRisk: number;
}

export type Data = DummyTrmData | DummyMisttrackData;

const TRM_BASE_URL = "https://api.trmlabs.com/public/v2";
const MISTTRACK_BASE_URL = "https://openapi.misttrack.io/v1";
const TRM_API_KEY = "TODO";
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
  MISTTRACK_ADDRESS_RISK_SCORE: async (
    deposit: ScreeningDepositRequest,
    token = "ETH"
  ): Promise<MisttrackData> => {
    const response = await fetch(
      `${MISTTRACK_BASE_URL}/address_overview?coin=${token}&address=${deposit.spender}&api_key=${MISTTRACK_API_KEY}`
    );
    const data = (await response.json()) as MisttrackData;
    console.log(data);
    return data;
  },

  DUMMY_TRM_SCREENING_ADDRESSES: async (deposit: ScreeningDepositRequest) => {
    console.log(deposit);
    return await Promise.resolve({ risk: 0.5 });
  },
  // {{MISTTRACK_BASE_URL}}/risk_score
  DUMMY_MISTTRACK_ADDRESS_RISK_SCORE: async (
    deposit: ScreeningDepositRequest
  ) => {
    console.log(deposit);
    return await Promise.resolve({ misttrackRisk: 0.5 });
  },
} as const;
