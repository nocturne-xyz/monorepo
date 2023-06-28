import { Job, Queue } from "bullmq";
import { DepositScreenerDB } from "../db";
import { DepositRequestJobData } from "../types";
import {
  Address,
  AssetTrait,
  DepositRequest,
  DepositRequestStatus,
} from "@nocturne-xyz/sdk";
import { ScreenerDelayCalculator } from "../screenerDelay";
import { ScreeningApi } from "../screening";
import {
  totalValueAheadInFulfillerQueueInclusive,
  totalValueAheadInScreenerQueueInclusive,
  totalValueInFulfillerQueue,
} from "./valueAhead";
import {
  calculateSecondsLeftInJobDelay,
  convertAssetTotalToDelaySeconds,
} from "./time";
import { Logger } from "winston";

export interface EstimateExistingWaitDeps {
  db: DepositScreenerDB;
  rateLimits: Map<Address, bigint>;
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
  logger: Logger;
}

// NOTE: This function can throw errors
export async function estimateSecondsUntilDepositCompletion(
  {
    db,
    screenerQueue,
    fulfillerQueues,
    rateLimits,
    logger,
  }: EstimateExistingWaitDeps,
  depositHash: string
): Promise<number> {
  // get deposit request status
  const status = await db.getDepositRequestStatus(depositHash);
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
  let job: Job<DepositRequestJobData>;
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

    let date = Date.now();
    const valueAheadInScreenerQueue =
      await totalValueAheadInScreenerQueueInclusive(screenerQueue, job);
    logger.info(
      `Got total value in screener queue. Latency ${Date.now() - date}`
    );

    date = Date.now();
    const valueInFulfillerQueue = await totalValueInFulfillerQueue(
      fulfillerQueue
    );
    logger.info(
      `Got total value in fulfiller queue. Latency ${Date.now() - date}`
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

    const date = Date.now();
    valueAhead = await totalValueAheadInFulfillerQueueInclusive(
      fulfillerQueue,
      job
    );
    logger.info(
      `Got total value in fulfiller queue. Latency ${Date.now() - date}`
    );
  } else {
    throw new Error(
      `Deposit does not exist or failed. depositHash: ${depositHash}`
    );
  }

  // get existing job delay
  const secondsLeftInJobDelay = calculateSecondsLeftInJobDelay(job);

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
  logger: Logger;
}

// NOTE: This function can throw error
export async function estimateSecondsUntilCompletionForProspectiveDeposit(
  {
    screeningApi,
    screenerDelayCalculator,
    screenerQueue,
    fulfillerQueues,
    rateLimits,
    logger,
  }: EstimateProspectiveWaitDeps,
  spender: Address,
  assetAddr: Address,
  value: bigint
): Promise<number> {
  // ensure passes screen
  let date = Date.now();
  const passesScreen = await screeningApi.isSafeDepositRequest(
    spender,
    assetAddr,
    value
  );
  logger.info(`[quote] Got screening result. Latency ${Date.now() - date}`);

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
  date = Date.now();
  const screenerDelay = await screenerDelayCalculator.calculateDelaySeconds(
    spender,
    assetAddr,
    value
  );
  logger.info(`[quote] Got screener delay. Latency ${Date.now() - date}`);

  // find closest job in screener queue to hypothetical job
  date = Date.now();
  const closestJob = await findScreenerQueueJobClosestInDelay(
    screenerQueue,
    assetAddr,
    screenerDelay
  );
  logger.info(
    `[quote] Got closest job in screener queue. Latency ${Date.now() - date}`
  );

  // calculate value ahead of closest job
  let valueAhead: bigint;
  if (!closestJob) {
    valueAhead = 0n;
  } else {
    date = Date.now();
    const valueAheadInScreenerQueue =
      await totalValueAheadInScreenerQueueInclusive(screenerQueue, closestJob);
    logger.info(
      `[quote] Got total value in screener queue. Latency ${Date.now() - date}`
    );

    date = Date.now();
    const valueInFulfillerQueue = await totalValueInFulfillerQueue(
      fulfillerQueue
    );
    logger.info(
      `[quote] Got total value in fulfiller queue. Latency ${Date.now() - date}`
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
  let date = Date.now();
  console.log(`Getting delayed jobs`);
  const screenerDelayed = await screenerQueue.getDelayed();
  console.log(`Got delayed jobs. Latency ${Date.now() - date}`);

  date = Date.now();
  console.log(`Getting waiting jobs`);
  const screenerWaiting = await screenerQueue.getWaiting();
  console.log(`Got waiting jobs. Latency ${Date.now() - date}`);

  date = Date.now();
  console.log(`Filtering jobs`);
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
  console.log(`Filtered jobs. Latency ${Date.now() - date}`);

  if (screenerJobsAhead.length == 0) {
    return undefined;
  } else {
    return screenerJobsAhead[0];
  }
}
