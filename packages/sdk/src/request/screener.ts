import { Address, DepositRequestStatus } from "../primitives";

export interface QuoteRequest {
  spender: Address;
  assetAddr: Address;
  value: bigint;
}

export interface QuoteResponse {
  estimatedWaitSeconds: number;
}

export interface DepositStatusResponse {
  status: DepositRequestStatus;
  estimatedWaitSeconds: number;
}
