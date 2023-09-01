import { ScreeningDepositRequest } from "..";

export interface DummyTrmData {
  risk: number;
}
export interface DummyMisttrackData {
  misttrackRisk: number;
}

export type Data = DummyTrmData | DummyMisttrackData;

export const API_CALLS = {
  // {{TRM_URL}}/public/v2/screening/addresses
  TRM_SCREENING_ADDRESSES: async (deposit: ScreeningDepositRequest) => {
    console.log(deposit);
    return await Promise.resolve({ risk: 0.5 });
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
