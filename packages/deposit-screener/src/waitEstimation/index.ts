import { Job } from "bullmq";
import { DepositScreenerDB } from "../db";
import { DepositRequestJobData, DepositRequestStatus } from "../types";
import { Address, AssetTrait, DepositRequest } from "@nocturne-xyz/sdk";
import { ScreenerDelayCalculator } from "../screenerDelay";
import { ScreeningApi } from "../screening";
import * as JSON from "bigint-json-serialization";
import { millisToSeconds } from "../utils";
import {
  EstimateDelayAheadFromQueuesDeps,
  calculateTotalValueAheadInAsset,
} from "./delayAhead";

const SECS_IN_HOUR = 60 * 60;

export enum QueueType {
  Screener,
  Fulfiller,
}

function convertAssetTotalToDelaySeconds(
  assetAddr: Address,
  totalValue: bigint,
  rateLimits: Map<Address, bigint>
): number {
  const rateLimit = rateLimits.get(assetAddr);
  if (!rateLimit) {
    throw new Error(`No rate limit for asset ${assetAddr}`);
  }

  // Must do fraction-preserving div using numbers
  const waitHours = Number(totalValue) / Number(rateLimit);
  return Math.floor(waitHours * SECS_IN_HOUR);
}

export interface EstimateExistingWaitDeps
  extends EstimateDelayAheadFromQueuesDeps {
  db: DepositScreenerDB;
}

// NOTE: This function can throw errors
export async function estimateWaitAheadSecondsForExisting(
  { db, screenerQueue, fulfillerQueues, rateLimits }: EstimateExistingWaitDeps,
  depositHash: string
): Promise<number> {
  const status = await db.getDepositRequestStatus(depositHash);
  if (!status) {
    throw new Error(`No status found for deposit hash ${depositHash}`);
  }

  let queueType: QueueType;
  switch (status) {
    case DepositRequestStatus.PassedFirstScreen:
      queueType = QueueType.Screener;
      break;
    case DepositRequestStatus.AwaitingFulfillment:
      queueType = QueueType.Fulfiller;
      break;
    case DepositRequestStatus.Completed:
      return 0; // TODO: is desired behavior?
    default:
      throw new Error(`Deposit does not exist or failed`);
  }

  let jobDelayMs: number;
  let jobData: Job<DepositRequestJobData, any, string>;
  if (queueType == QueueType.Screener) {
    const maybeJobData = await screenerQueue.getJob(depositHash);
    if (!maybeJobData) {
      throw new Error(
        `Could not find job in screener queue for deposit hash ${depositHash}`
      );
    }
    jobDelayMs = maybeJobData.delay;
    jobData = maybeJobData;
  } else {
    const depositRequest = await db.getDepositRequest(depositHash);
    if (!depositRequest) {
      throw new Error(
        `No deposit request found for deposit hash ${depositHash}`
      );
    }

    const assetAddr = AssetTrait.decode(depositRequest.encodedAsset).assetAddr;
    const fulfillerQueue = fulfillerQueues.get(assetAddr);
    if (!fulfillerQueue) {
      throw new Error(`No fulfiller queue for asset ${assetAddr}`);
    }

    const maybeJobData = await fulfillerQueue.getJob(depositHash);
    if (!maybeJobData) {
      throw new Error(
        `Could not find job in screener queue for deposit hash ${depositHash}`
      );
    }
    jobDelayMs = maybeJobData.delay;
    jobData = maybeJobData;
  }

  const depositRequest: DepositRequest = JSON.parse(
    jobData.data.depositRequestJson
  );

  // Get time left in job delay
  const enqueuedDateMs = jobData.timestamp;
  const enqueuedToNowDifferenceMs = Date.now() - enqueuedDateMs;
  const secondsLeftInJobDelay = Math.ceil(
    (jobDelayMs - enqueuedToNowDifferenceMs) / 1000
  );

  // Get time for jobs ahead of job
  const assetAddr = AssetTrait.decode(depositRequest.encodedAsset).assetAddr;
  const valueAhead = await calculateTotalValueAheadInAsset(
    {
      screenerQueue,
      fulfillerQueues,
      rateLimits,
    },
    queueType,
    assetAddr,
    jobDelayMs
  );

  return (
    secondsLeftInJobDelay +
    convertAssetTotalToDelaySeconds(assetAddr, valueAhead, rateLimits)
  );
}

export interface EstimateProspectiveWaitDeps
  extends EstimateDelayAheadFromQueuesDeps {
  screeningApi: ScreeningApi;
  screenerDelayCalculator: ScreenerDelayCalculator;
}

// NOTE: This function can throw error
export async function estimateWaitAheadSecondsForProspective(
  {
    screeningApi,
    screenerDelayCalculator,
    screenerQueue,
    fulfillerQueues,
    rateLimits,
  }: EstimateProspectiveWaitDeps,
  spender: Address,
  assetAddr: Address,
  value: bigint
): Promise<number> {
  const passesScreen = await screeningApi.isSafeDepositRequest(
    spender,
    assetAddr,
    value
  );

  if (!passesScreen) {
    throw new Error(
      `Prospective deposit request failed screening. spender: ${spender}. assetAddr: ${assetAddr}, value: ${value}`
    );
  }

  const screenerDelay = await screenerDelayCalculator.calculateDelaySeconds(
    spender,
    assetAddr,
    value
  );

  const valueAhead = await calculateTotalValueAheadInAsset(
    {
      screenerQueue,
      fulfillerQueues,
      rateLimits,
    },
    QueueType.Screener,
    assetAddr,
    millisToSeconds(screenerDelay)
  );

  return (
    screenerDelay +
    convertAssetTotalToDelaySeconds(assetAddr, valueAhead, rateLimits)
  );
}
