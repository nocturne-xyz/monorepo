import { DepositRequest } from "@nocturne-xyz/sdk";

export enum DepositEventType {
  Instantiated = "Instantiated",
  Retrieved = "Retrieved",
  Processed = "Processed",
}

export interface DepositEvent extends DepositRequest {
  type: DepositEventType;
}

export enum DepositRequestStatus {
  FailedDepositMappingCheck,
  FailedScreen,
  FailedRateLimit,
  PassedScreen,
  Enqueued,
  Processed,
}

export const DEPOSIT_DELAY_QUEUE = "DepositDelayQueue";
export const DELAYED_DEPOSIT_JOB_TAG = "DELAYED_DEPOSIT";

export type DelayedDepositJobData = {
  depositRequestJson: string;
};
