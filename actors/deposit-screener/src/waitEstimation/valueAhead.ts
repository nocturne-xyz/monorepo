import { Job, Queue } from "bullmq";
import { DepositRequestJobData } from "../types";
import { AssetTrait, DepositRequest } from "@nocturne-xyz/sdk";
import * as JSON from "bigint-json-serialization";

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
