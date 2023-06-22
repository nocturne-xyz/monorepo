import { Address, DepositRequestStatus } from "../primitives";

export interface DepositQuoteRequest {
  spender: Address;
  assetAddr: Address;
  value: bigint;
}

export interface DepositQuoteResponse {
  estimatedWaitSeconds: number;
}

export interface DepositStatusResponse {
  status: DepositRequestStatus;
  estimatedWaitSeconds?: number;
}
