import { Queue } from "bullmq";
import { DepositEventJobData, SCREENER_DELAY_QUEUE, getFulfillmentQueueName } from "../types";
import { Address, DepositEvent, min } from "@nocturne-xyz/core";
import * as JSON from "bigint-json-serialization";
import IORedis from "ioredis";

export class QueueValueCounter {
  fulfillerValues: Map<Address, bigint>;
  screenerValue: bigint;

  constructor(supportedAssets: Address[]) {
    this.fulfillerValues = new Map(
      supportedAssets.map((address) => [address, 0n])
    );
    this.screenerValue = 0n;
  }

  async init(redis: IORedis): Promise<void> {
    const screenerQueue = new Queue<DepositEventJobData>(SCREENER_DELAY_QUEUE, {
      connection: redis,
    });
    this.screenerValue = await totalValueInScreenerQueue(screenerQueue);

    let values = new Map();
    await Promise.all([...this.fulfillerValues.keys()].map(async (address) => {
      const fulfillerQueue = new Queue<DepositEventJobData>(
        getFulfillmentQueueName(address),
        { connection: redis }
      );

      values.set(address, await totalValueInFulfillerQueue(fulfillerQueue));
    }));
    this.fulfillerValues = values;
  }

  addToScreenerValue(amount: bigint) {
    this.screenerValue += amount;
  }

  addToFulfillerValue(assetAddr: Address, amount: bigint) {
    this.fulfillerValues.set(assetAddr, (this.fulfillerValues.get(assetAddr) ?? 0n) + amount);
  }

  subtractFromScreenerValue(amount: bigint) {
    this.screenerValue -= amount;
  }

  subtractFromFulfillerValue(assetAddr: Address, amount: bigint) {
    this.fulfillerValues.set(assetAddr, min(0n, (this.fulfillerValues.get(assetAddr) ?? 0n) - amount));
  }
}

async function totalValueInScreenerQueue(
  screenerQueue: Queue<DepositEventJobData>,
): Promise<bigint> {
  const [screenerDelayed, screenerWaiting] = await Promise.all([
    screenerQueue.getDelayed(),
    screenerQueue.getWaiting(),
  ]);

  // get all fulfiller queue jobs that are ahead of the job in question by timestamp
  return [...screenerDelayed, ...screenerWaiting].map(
    (j) => JSON.parse(j.data.depositEventJson) as DepositEvent
  ).reduce((acc, deposit) => acc + deposit.value, 0n);
}


async function totalValueInFulfillerQueue(
  fulfillerQueue: Queue<DepositEventJobData>
): Promise<bigint> {
  const [screenerDelayed, screenerWaiting] = await Promise.all([
    fulfillerQueue.getDelayed(),
    fulfillerQueue.getWaiting(),
  ]);

  // get all fulfiller queue jobs that are ahead of the job in question by timestamp
  return [...screenerDelayed, ...screenerWaiting].map(
    (j) => JSON.parse(j.data.depositEventJson) as DepositEvent
  ).reduce((acc, deposit) => acc + deposit.value, 0n);
}
