import { Job, Queue } from "bullmq";
import { DepositEventJobData } from "../types";
import { AssetTrait, DepositEvent, DepositRequest } from "@nocturne-xyz/core";
import * as JSON from "bigint-json-serialization";

export async function totalValueAheadInScreenerQueueInclusive(
  screenerQueue: Queue<DepositEventJobData>,
  job: Job<DepositEventJobData>
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
  fulfillerQueue: Queue<DepositEventJobData>,
  job: Job<DepositEventJobData>
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
  fulfillerQueue: Queue<DepositEventJobData>
): Promise<bigint> {
  const deposits: DepositRequest[] = [];
  const screenerDelayed = await fulfillerQueue.getDelayed();
  const screenerWaiting = await fulfillerQueue.getWaiting();

  // get all fulfiller queue jobs that are ahead of the job in question by timestamp
  const depositsInScreenerQueue = [...screenerDelayed, ...screenerWaiting].map(
    (j) => JSON.parse(j.data.depositRequestJson) as DepositEvent
  );
  deposits.push(...depositsInScreenerQueue);

  return deposits.reduce((acc, deposit) => acc + deposit.value, 0n);
}
