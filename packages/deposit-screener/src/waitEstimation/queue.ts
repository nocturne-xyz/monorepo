import { Queue } from "bullmq";
import { QueueType, WaitEstimator } from "./waitEstimator";
import { DepositRequestJobData } from "../types";
import { Address, AssetTrait, DepositRequest } from "@nocturne-xyz/sdk";

export class QueueWaitEstimator implements WaitEstimator {
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
  rateLimits: Map<Address, bigint>;

  constructor(
    screenerQueue: Queue,
    fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>,
    rateLimits: Map<Address, bigint>
  ) {
    this.screenerQueue = screenerQueue;
    this.fulfillerQueues = fulfillerQueues;
    this.rateLimits = rateLimits;
  }

  async estimateWaitTimeSeconds(
    queueType: QueueType,
    assetAddr: Address,
    jobDelayMs: number
  ): Promise<number> {
    let depositsAhead: DepositRequest[] = [];
    if (queueType == QueueType.Screener) {
      const screenerDelayed = await this.screenerQueue.getDelayed();
      const screenerWaiting = await this.screenerQueue.getWaiting();

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

    const fulfillerQueue = this.fulfillerQueues.get(assetAddr);
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
        .map(
          (job) => JSON.parse(job.data.depositRequestJson) as DepositRequest
        );
    }

    depositsAhead.push(...depositsAheadInFulfillerQueue);

    const totalValueAhead = depositsAhead.reduce(
      (acc, deposit) => acc + deposit.value,
      0n
    );

    const rateLimit = this.rateLimits.get(assetAddr);
    if (!rateLimit) {
      throw new Error(`No rate limit for asset ${assetAddr}`);
    }

    const waitHours = Number(totalValueAhead / rateLimit);
    return waitHours * 60 * 60;
  }
}
