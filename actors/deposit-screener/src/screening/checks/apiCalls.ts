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

export interface DummyTrmData {
  risk: number;
}
export interface DummyMisttrackData {
  misttrackRisk: number;
}

export type Data = DummyTrmData | DummyMisttrackData;

const TRM_BASE_URL = "https://api.trmlabs.com/public/v2";
const TRM_SCREENING_ADDRESSES_ENDPOINT = `${TRM_BASE_URL}/screening/addresses`;
const TRM_API_KEY = "TODO";

export const API_CALLS = {
  TRM_SCREENING_ADDRESSES: async (
    deposit: ScreeningDepositRequest
  ): Promise<TrmData> => {
    const body = JSON.stringify({
      address: deposit.spender,
      chain: "ethereum",
    });
    const response = await fetch(TRM_SCREENING_ADDRESSES_ENDPOINT, {
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
