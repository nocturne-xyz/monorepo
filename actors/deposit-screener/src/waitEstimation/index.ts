import {
  Address,
  AssetTrait,
  DepositEvent,
  DepositRequestStatus,
} from "@nocturne-xyz/core";
import * as JSON from "bigint-json-serialization";
import { Job, Queue } from "bullmq";
import { DepositScreenerDB } from "../db";
import { ScreeningCheckerApi } from "../screening";
import { DepositEventJobData } from "../types";
import {
  calculateSecondsLeftInJobDelay,
  convertAssetTotalToDelaySeconds,
} from "./time";
import {
  totalValueAheadInFulfillerQueueInclusive,
  totalValueAheadInScreenerQueueInclusive,
  totalValueInFulfillerQueue,
} from "./valueAhead";

export interface EstimateExistingWaitDeps {
  db: DepositScreenerDB;
  rateLimits: Map<Address, bigint>;
  screenerQueue: Queue<DepositEventJobData>;
  fulfillerQueues: Map<Address, Queue<DepositEventJobData>>;
}

// NOTE: This function can throw errors
export async function estimateSecondsUntilDepositCompletion(
  { db, screenerQueue, fulfillerQueues, rateLimits }: EstimateExistingWaitDeps,
  depositHash: string,
  status: DepositRequestStatus
): Promise<number> {
  // get deposit request status
  console.log("Entered estimateSecondsUntilDepositCompletion", depositHash);
  if (status === DepositRequestStatus.DoesNotExist) {
    throw new Error(`No status found for deposit hash ${depositHash}`);
  }

  // recover deposit request struct so we know what asset
  const depositRequest = await db.getDepositRequest(depositHash);
  if (!depositRequest) {
    throw new Error(`No deposit request found for deposit hash ${depositHash}`);
  }

  const assetAddr = AssetTrait.decode(depositRequest.encodedAsset).assetAddr;
  const fulfillerQueue = fulfillerQueues.get(assetAddr);
  if (!fulfillerQueue) {
    throw new Error(`No fulfiller queue for asset ${assetAddr}`);
  }

  /// Get asset value ahead of deposit
  let valueAhead: bigint;
  let job: Job<DepositEventJobData>;
  console.log("estimateSecondsUntilDepositCompletion status", status);
  if (status == DepositRequestStatus.Completed) {
    return 0;
  } else if (status == DepositRequestStatus.PassedFirstScreen) {
    const maybeJob = await screenerQueue.getJob(depositHash);
    if (!maybeJob) {
      throw new Error(
        `Could not find job in screener queue for deposit hash ${depositHash}`
      );
    }
    job = maybeJob;

    const valueAheadInScreenerQueue =
      await totalValueAheadInScreenerQueueInclusive(screenerQueue, job);
    const valueInFulfillerQueue = await totalValueInFulfillerQueue(
      fulfillerQueue
    );
    valueAhead = valueAheadInScreenerQueue + valueInFulfillerQueue;
  } else if (status == DepositRequestStatus.AwaitingFulfillment) {
    const maybeJob = await fulfillerQueue.getJob(depositHash);
    if (!maybeJob) {
      throw new Error(
        `Could not find job in screener queue for deposit hash ${depositHash}`
      );
    }
    job = maybeJob;

    valueAhead = await totalValueAheadInFulfillerQueueInclusive(
      fulfillerQueue,
      job
    );
  } else {
    throw new Error(
      `Deposit does not exist or failed. depositHash: ${depositHash}`
    );
  }

  // get existing job delay
  const secondsLeftInJobDelay = calculateSecondsLeftInJobDelay(job);

  const delaySeconds = convertAssetTotalToDelaySeconds(
    assetAddr,
    valueAhead,
    rateLimits
  );
  console.log("secondsLeftInJobDelay", secondsLeftInJobDelay);
  console.log("delaySeconds", delaySeconds);
  return secondsLeftInJobDelay + delaySeconds;
}

export interface EstimateProspectiveWaitDeps {
  screeningApi: ScreeningCheckerApi;
  rateLimits: Map<Address, bigint>;
  screenerQueue: Queue<DepositEventJobData>;
  fulfillerQueues: Map<Address, Queue<DepositEventJobData>>;
}

// NOTE: This function can throw error
export async function estimateSecondsUntilCompletionForProspectiveDeposit(
  {
    screeningApi,
    screenerQueue,
    fulfillerQueues,
    rateLimits,
  }: EstimateProspectiveWaitDeps,
  spender: Address,
  assetAddr: Address,
  value: bigint
): Promise<number> {
  // ensure passes screen
  console.log("in estimateSecondsUntilCompletionForProspectiveDeposit");

  const checkResult = await screeningApi.checkDeposit({
    spender,
    assetAddr,
    value,
  });

  if (checkResult.type === "Rejection") {
    throw new Error(
      `Prospective deposit request failed screening. reason: ${checkResult.reason} spender: ${spender}. assetAddr: ${assetAddr}, value: ${value}`
    );
  }

  const fulfillerQueue = fulfillerQueues.get(assetAddr);
  if (!fulfillerQueue) {
    throw new Error(`No fulfiller queue for asset ${assetAddr}`);
  }

  // find closest job in screener queue to hypothetical job
  const closestJob = await findScreenerQueueJobClosestInDelay(
    screenerQueue,
    assetAddr,
    checkResult.timeSeconds
  );
  console.log("closestJob", closestJob);

  // calculate value ahead of closest job
  let valueAhead: bigint;
  if (!closestJob) {
    valueAhead = 0n;
  } else {
    const valueAheadInScreenerQueue =
      await totalValueAheadInScreenerQueueInclusive(screenerQueue, closestJob);
    const valueInFulfillerQueue = await totalValueInFulfillerQueue(
      fulfillerQueue
    );
    valueAhead = valueAheadInScreenerQueue + valueInFulfillerQueue;
    console.log(
      "valueAheadInScreenerQueue",
      "valueInFulfillerQueue",
      "valueAhead",
      valueAheadInScreenerQueue,
      valueInFulfillerQueue,
      valueAhead
    );
  }
  const delaySeconds = convertAssetTotalToDelaySeconds(
    assetAddr,
    valueAhead,
    rateLimits
  );

  console.log("screenerDelay", checkResult.timeSeconds);
  console.log("delaySeconds", delaySeconds);
  return checkResult.timeSeconds + delaySeconds;
}

async function findScreenerQueueJobClosestInDelay(
  screenerQueue: Queue<DepositEventJobData>,
  assetAddr: Address,
  delayMs: number
): Promise<Job<DepositEventJobData> | undefined> {
  const screenerDelayed = await screenerQueue.getDelayed();
  const screenerWaiting = await screenerQueue.getWaiting();

  const screenerJobs = [...screenerDelayed, ...screenerWaiting];
  const screenerJobsAhead = screenerJobs
    .filter((job) => {
      const depositRequest: DepositEvent = JSON.parse(
        job.data.depositEventJson
      );
      return (
        AssetTrait.decode(depositRequest.encodedAsset).assetAddr == assetAddr
      );
    })
    .filter((job) => job.delay <= delayMs);
  screenerJobsAhead.sort((a, b) => b.delay - a.delay);

  if (screenerJobsAhead.length == 0) {
    return undefined;
  } else {
    return screenerJobsAhead[0];
  }
}
