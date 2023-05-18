import { Queue } from "bullmq";
import { DepositScreenerDB } from "../db";
import { DepositRequestJobData, DepositRequestStatus } from "../types";
import { Logger } from "winston";
import { Address, Asset } from "@nocturne-xyz/sdk";
import { ScreenerDelayCalculator } from "../screenerDelay";

export enum QueueType {
  Screener,
  Fulfiller,
}

export interface WaitEstimator {
  estimateWaitTime(queue: QueueType, delay: number): Promise<number>;
}

interface EstimateExistingWaitDeps {
  db: DepositScreenerDB;
  logger: Logger;
  waitEstimator: WaitEstimator;
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueue: Queue<DepositRequestJobData>;
}

export async function estimateWaitTimeForExisting(
  deps: EstimateExistingWaitDeps,
  depositHash: string
): Promise<number | undefined> {
  const status = await deps.db.getDepositRequestStatus(depositHash);

  if (!status) {
    return undefined;
  }

  let queueType: QueueType;
  switch (status) {
    case DepositRequestStatus.PassedFirstScreen:
      queueType = QueueType.Screener;
      break;
    case DepositRequestStatus.AwaitingFulfillment:
      queueType = QueueType.Fulfiller;
      break;
    default:
      return undefined; // TODO: maybe throw err here?
  }

  let delayInCurrentQueue: number;
  if (queueType == QueueType.Screener) {
    const jobData = await deps.screenerQueue.getJob(depositHash);
    if (!jobData) {
      const errMsg = `Could not find job in screener queue for deposit hash ${depositHash}`;
      deps.logger.error(errMsg);
      throw new Error(errMsg);
    }
    delayInCurrentQueue = jobData.delay;
  } else {
    const jobData = await deps.fulfillerQueue.getJob(depositHash);
    if (!jobData) {
      const errMsg = `Could not find job in screener queue for deposit hash ${depositHash}`;
      deps.logger.error(errMsg);
      throw new Error(errMsg);
    }
    delayInCurrentQueue = jobData.delay;
  }

  return deps.waitEstimator.estimateWaitTime(queueType, delayInCurrentQueue);
}

interface EstimateProspectiveWaitDeps {
  waitEstimator: WaitEstimator;
  screenerDelayCalculator: ScreenerDelayCalculator;
}

export async function estimateWaitTimeForProspective(
  deps: EstimateProspectiveWaitDeps,
  spender: Address,
  asset: Asset,
  value: bigint
): Promise<number | undefined> {
  const screenerDelay =
    await deps.screenerDelayCalculator.calculateDelaySeconds(
      spender,
      asset,
      value
    );

  return deps.waitEstimator.estimateWaitTime(QueueType.Screener, screenerDelay);
}
