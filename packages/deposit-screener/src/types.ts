import { Address, DepositRequest } from "@nocturne-xyz/sdk";

export const ONE_HOUR_IN_MS = 60 * 60 * 1000;

export enum DepositEventType {
  Instantiated = "Instantiated",
  Retrieved = "Retrieved",
  Processed = "Processed",
}

export interface DepositEvent extends DepositRequest {
  type: DepositEventType;
}

export const SUBMISSION_QUEUE = "DepositSubmissionQueue";
export const SUBMISSION_JOB_TAG = "DEPOSIT_SUBMISSION";

export const SCREENER_DELAY_QUEUE = "ScreenerDelayQueue";
export const DELAYED_DEPOSIT_JOB_TAG = "SCREENER_DELAY";

export function getFulfillmentQueueName(assetAddr: Address): string {
  return `${FULFILLMENT_QUEUE}_${assetAddr}`;
}
export function getFulfillmentJobTag(assetAddr: Address): string {
  return `${FULFILLMENT_JOB_TAG}_${assetAddr}`;
}

const FULFILLMENT_QUEUE = "DepositFulfillmentQueue";
const FULFILLMENT_JOB_TAG = "DEPOSIT_FULFILLMENT";

export type DepositRequestJobData = {
  depositRequestJson: string;
};
