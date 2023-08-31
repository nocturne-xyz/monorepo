import { DepositRequest } from "@nocturne-xyz/core";

export interface TrmData {
  risk: number; // TODO, use vals from response
}
export interface MisttrackData {
  misttrackRisk: number;
}

export type Data = TrmData | MisttrackData;

export const API_CALLS = {
  // {{TRM_URL}}/public/v2/screening/addresses
  TRM_SCREENING_ADDRESSES: async (deposit: DepositRequest) => {
    console.log(deposit);
    return await Promise.resolve({ risk: 0.5 });
  },
  // {{MISTTRACK_BASE_URL}}/risk_score
  MISTTRACK_ADDRESS_RISK_SCORE: async (deposit: DepositRequest) => {
    console.log(deposit);
    return await Promise.resolve({ misttrackRisk: 0.5 });
  },
} as const;
