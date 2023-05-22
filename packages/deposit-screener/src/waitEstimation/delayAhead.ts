import { Job, Queue } from "bullmq";
import { QueueType } from ".";
import { DepositRequestJobData } from "../types";
import { Address, AssetTrait, DepositRequest } from "@nocturne-xyz/sdk";
import * as JSON from "bigint-json-serialization";

export interface EstimateDelayAheadFromQueuesDeps {
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
}

export async function findScreenerQueueJobClosestInDelay(
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

export async function calculateTotalValueAheadInAssetInclusive(
  { screenerQueue, fulfillerQueues }: EstimateDelayAheadFromQueuesDeps,
  queueType: QueueType,
  job: Job<DepositRequestJobData>
): Promise<bigint> {
  const depositRequest: DepositRequest = JSON.parse(
    job.data.depositRequestJson
  );
  const assetAddr = AssetTrait.decode(depositRequest.encodedAsset).assetAddr;

  let valueAhead = 0n;
  const fulfillerQueue = fulfillerQueues.get(assetAddr);
  if (!fulfillerQueue) {
    throw new Error(`No fulfiller queue for asset ${assetAddr}`);
  }

  if (queueType == QueueType.Screener) {
    // if in screener queue, add value ahead for both queues
    valueAhead += await totalValueAheadInScreenerQueueInclusive(
      screenerQueue,
      job
    );
    valueAhead += await totalValueInFulfillerQueue(fulfillerQueue);
  } else {
    // otherwise just ahead value ahead in fulfiller queue
    valueAhead += await totalValueAheadInFulfillerQueueInclusive(
      fulfillerQueue,
      job
    );
  }

  return valueAhead;
}

export async function totalValueAheadInScreenerQueueInclusive(
  screenerQueue: Queue<DepositRequestJobData>,
  job: Job<DepositRequestJobData>
): Promise<bigint> {
  const depositRequest: DepositRequest = JSON.parse(
    job.data.depositRequestJson
  );
  const assetAddr = AssetTrait.decode(depositRequest.encodedAsset).assetAddr;

  const depositsAhead: DepositRequest[] = [];
  const screenerDelayed = await screenerQueue.getDelayed();
  const screenerWaiting = await screenerQueue.getWaiting();

  // get all screener queue jobs that are ahead of the job in question
  const depositsAheadInScreenerQueue = [
    job,
    ...screenerDelayed,
    ...screenerWaiting,
  ]
    .filter((j) => j.delay <= job.delay)
    .map((j) => JSON.parse(j.data.depositRequestJson) as DepositRequest)
    .filter(
      (deposit) =>
        AssetTrait.decode(deposit.encodedAsset).assetAddr == assetAddr
    );
  depositsAhead.push(...depositsAheadInScreenerQueue);

  return depositsAhead.reduce((acc, deposit) => acc + deposit.value, 0n);
}

export async function totalValueAheadInFulfillerQueueInclusive(
  fulfillerQueue: Queue<DepositRequestJobData>,
  job: Job<DepositRequestJobData>
): Promise<bigint> {
  const depositsAhead: DepositRequest[] = [];
  const screenerDelayed = await fulfillerQueue.getDelayed();
  const screenerWaiting = await fulfillerQueue.getWaiting();

  // get all fulfiller queue jobs that are ahead of the job in question by timestamp
  const depositsAheadInScreenerQueue = [
    job,
    ...screenerDelayed,
    ...screenerWaiting,
  ]
    .filter((j) => j.timestamp <= job.timestamp)
    .map((j) => JSON.parse(j.data.depositRequestJson) as DepositRequest);
  depositsAhead.push(...depositsAheadInScreenerQueue);

  return depositsAhead.reduce((acc, deposit) => acc + deposit.value, 0n);
}

export async function totalValueInFulfillerQueue(
  fulfillerQueue: Queue<DepositRequestJobData>
): Promise<bigint> {
  const deposits: DepositRequest[] = [];
  const screenerDelayed = await fulfillerQueue.getDelayed();
  const screenerWaiting = await fulfillerQueue.getWaiting();

  // get all fulfiller queue jobs that are ahead of the job in question by timestamp
  const depositsInScreenerQueue = [...screenerDelayed, ...screenerWaiting].map(
    (j) => JSON.parse(j.data.depositRequestJson) as DepositRequest
  );
  deposits.push(...depositsInScreenerQueue);

  return deposits.reduce((acc, deposit) => acc + deposit.value, 0n);
}
