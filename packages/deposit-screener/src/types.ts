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
  FailedDepositMappingCheck = "FailedDepositMappingCheck",
  FailedScreen = "FailedScreen",
  FailedRateLimit = "FailedRateLimit",
  PassedScreen = "PassedScreen",
  Enqueued = "Enqueued",
  Processed = "Processed",
}

export const DELAYED_DEPOSIT_QUEUE = "DelayedDepositQueue";
export const DELAYED_DEPOSIT_JOB_TAG = "DELAYED_DEPOSIT";

export type DelayedDepositJobData = {
  depositRequestJson: string;
};
