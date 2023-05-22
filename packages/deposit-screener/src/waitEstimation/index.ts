import { Job, Queue } from "bullmq";
import { DepositScreenerDB } from "../db";
import { DepositRequestJobData, DepositRequestStatus } from "../types";
import { Address, AssetTrait, DepositRequest } from "@nocturne-xyz/sdk";
import { ScreenerDelayCalculator } from "../screenerDelay";
import { ScreeningApi } from "../screening";
import {
  totalValueAheadInFulfillerQueueInclusive,
  totalValueAheadInScreenerQueueInclusive,
  totalValueInFulfillerQueue,
} from "./valueAhead";
import {
  calculateTimeLeftInJobDelaySeconds,
  convertAssetTotalToDelaySeconds,
} from "./time";

export interface EstimateExistingWaitDeps {
  db: DepositScreenerDB;
  rateLimits: Map<Address, bigint>;
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
}

// NOTE: This function can throw errors
export async function estimateWaitAheadSecondsForExisting(
  { db, screenerQueue, fulfillerQueues, rateLimits }: EstimateExistingWaitDeps,
  depositHash: string
): Promise<number> {
  // get deposit request status
  const status = await db.getDepositRequestStatus(depositHash);
  if (!status) {
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
  let job: Job<DepositRequestJobData>;
  if (status == DepositRequestStatus.PassedFirstScreen) {
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
  } else if (status == DepositRequestStatus.Completed) {
    return 0;
  } else {
    throw new Error(
      `Deposit does not exist or failed. depositHash: ${depositHash}`
    );
  }

  // get existing job delay
  const secondsLeftInJobDelay = calculateTimeLeftInJobDelaySeconds(job);

  return (
    secondsLeftInJobDelay +
    convertAssetTotalToDelaySeconds(assetAddr, valueAhead, rateLimits)
  );
}

export interface EstimateProspectiveWaitDeps {
  screeningApi: ScreeningApi;
  screenerDelayCalculator: ScreenerDelayCalculator;
  rateLimits: Map<Address, bigint>;
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
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
  // ensure passes screen
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

  const fulfillerQueue = fulfillerQueues.get(assetAddr);
  if (!fulfillerQueue) {
    throw new Error(`No fulfiller queue for asset ${assetAddr}`);
  }

  // calculate hypothetical screener delay
  const screenerDelay = await screenerDelayCalculator.calculateDelaySeconds(
    spender,
    assetAddr,
    value
  );

  // find closest job in screener queue to hypothetical job
  const closestJob = await findScreenerQueueJobClosestInDelay(
    screenerQueue,
    assetAddr,
    screenerDelay
  );

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
  }

  return (
    screenerDelay +
    convertAssetTotalToDelaySeconds(assetAddr, valueAhead, rateLimits)
  );
}

async function findScreenerQueueJobClosestInDelay(
  screenerQueue: Queue<DepositRequestJobData>,
  assetAddr: Address,
  delayMs: number
): Promise<Job<DepositRequestJobData> | undefined> {
  const screenerDelayed = await screenerQueue.getDelayed();
  const screenerWaiting = await screenerQueue.getWaiting();

  const screenerJobs = [...screenerDelayed, ...screenerWaiting];
  const screenerJobsAhead = screenerJobs
    .filter((job) => {
      const depositRequest: DepositRequest = JSON.parse(
        job.data.depositRequestJson
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
