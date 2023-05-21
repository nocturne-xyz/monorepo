import { DepositRequestStatus } from "@nocturne-xyz/sdk";

export interface DepositStatusResponse {
  status: DepositRequestStatus;
  estimatedWaitSeconds: number;
}

export interface DepositQuoteResponse {
  estimatedWaitSeconds: number;
}
