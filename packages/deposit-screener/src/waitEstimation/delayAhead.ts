import { Queue } from "bullmq";
import { QueueType } from ".";
import { DepositRequestJobData } from "../types";
import { Address, AssetTrait, DepositRequest } from "@nocturne-xyz/sdk";

const SECS_IN_HOUR = 60 * 60;

export interface EstimateDelayAheadFromQueuesDeps {
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
  rateLimits: Map<Address, bigint>;
}

export async function estimateWaitAheadSeconds(
  {
    screenerQueue,
    fulfillerQueues,
    rateLimits,
  }: EstimateDelayAheadFromQueuesDeps,
  queueType: QueueType,
  assetAddr: Address,
  jobDelayMs: number
): Promise<number> {
  let depositsAhead: DepositRequest[] = [];
  if (queueType == QueueType.Screener) {
    const screenerDelayed = await screenerQueue.getDelayed();
    const screenerWaiting = await screenerQueue.getWaiting();

    // get all screener queue jobs that are ahead of the job in question
    const depositsAheadInScreenerQueue = [
      ...screenerDelayed,
      ...screenerWaiting,
    ]
      .filter((job) => job.delay < jobDelayMs)
      .map((job) => JSON.parse(job.data.depositRequestJson) as DepositRequest)
      .filter(
        (deposit) =>
          AssetTrait.decode(deposit.encodedAsset).assetAddr == assetAddr
      );
    depositsAhead.push(...depositsAheadInScreenerQueue);
  }

  const fulfillerQueue = fulfillerQueues.get(assetAddr);
  if (!fulfillerQueue) {
    throw new Error(`No fulfiller queue for asset ${assetAddr}`);
  }

  const fulfillerDelayed = await fulfillerQueue.getDelayed();
  const fulfillerWaiting = await fulfillerQueue.getWaiting();
  let depositsAheadInFulfillerQueue: DepositRequest[] = [];
  if (queueType == QueueType.Screener) {
    depositsAheadInFulfillerQueue = [
      ...fulfillerDelayed,
      ...fulfillerWaiting,
    ].map((job) => JSON.parse(job.data.depositRequestJson) as DepositRequest);
  } else {
    // filter out those before the deposit in question in fulfiller queue
    depositsAheadInFulfillerQueue = [...fulfillerDelayed, ...fulfillerWaiting]
      .filter((job) => job.delay < jobDelayMs)
      .map((job) => JSON.parse(job.data.depositRequestJson) as DepositRequest);
  }

  depositsAhead.push(...depositsAheadInFulfillerQueue);

  const totalValueAhead = depositsAhead.reduce(
    (acc, deposit) => acc + deposit.value,
    0n
  );

  const rateLimit = rateLimits.get(assetAddr);
  if (!rateLimit) {
    throw new Error(`No rate limit for asset ${assetAddr}`);
  }

  const waitHours = Number(totalValueAhead / rateLimit);
  return waitHours / SECS_IN_HOUR;
}
