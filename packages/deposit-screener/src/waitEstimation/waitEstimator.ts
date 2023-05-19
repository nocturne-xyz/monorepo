import { Job, Queue } from "bullmq";
import { DepositScreenerDB } from "../db";
import { DepositRequestJobData, DepositRequestStatus } from "../types";
import { Logger } from "winston";
import { Address, AssetTrait, DepositRequest } from "@nocturne-xyz/sdk";
import { ScreenerDelayCalculator } from "../screenerDelay";
import { ScreeningApi } from "../screening";
import * as JSON from "bigint-json-serialization";

export enum QueueType {
  Screener,
  Fulfiller,
}

export interface WaitEstimator {
  estimateWaitTimeSeconds(
    queue: QueueType,
    assetAddr: Address,
    delay: number
  ): Promise<number>;
}

interface EstimateExistingWaitDeps {
  db: DepositScreenerDB;
  logger: Logger;
  waitEstimator: WaitEstimator;
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
}

// NOTE: This function can throw errors
export async function estimateWaitTimeSecondsForExisting(
  deps: EstimateExistingWaitDeps,
  depositHash: string
): Promise<number> {
  const status = await deps.db.getDepositRequestStatus(depositHash);
  if (!status) {
    throw new Error(`No status found for deposit hash ${depositHash}`);
  }

  let queueType: QueueType;
  switch (status) {
    case DepositRequestStatus.PassedFirstScreen:
      queueType = QueueType.Screener;
      break;
    case DepositRequestStatus.AwaitingFulfillment:
      queueType = QueueType.Fulfiller;
      break;
    case DepositRequestStatus.Completed:
      return 0; // TODO: is desired behavior?
    default:
      throw new Error(`Deposit does not exist or failed`);
  }

  let delayInCurrentQueue: number;
  let jobData: Job<DepositRequestJobData, any, string>;
  if (queueType == QueueType.Screener) {
    const maybeJobData = await deps.screenerQueue.getJob(depositHash);
    if (!maybeJobData) {
      throw new Error(
        `Could not find job in screener queue for deposit hash ${depositHash}`
      );
    }
    delayInCurrentQueue = maybeJobData.delay;
    jobData = maybeJobData;
  } else {
    const depositRequest = await deps.db.getDepositRequest(depositHash);
    if (!depositRequest) {
      throw new Error(
        `No deposit request found for deposit hash ${depositHash}`
      );
    }

    const assetAddr = AssetTrait.decode(depositRequest.encodedAsset).assetAddr;
    const fulfillerQueue = deps.fulfillerQueues.get(assetAddr);
    if (!fulfillerQueue) {
      throw new Error(`No fulfiller queue for asset ${assetAddr}`);
    }

    const maybeJobData = await fulfillerQueue.getJob(depositHash);
    if (!maybeJobData) {
      throw new Error(
        `Could not find job in screener queue for deposit hash ${depositHash}`
      );
    }
    delayInCurrentQueue = maybeJobData.delay;
    jobData = maybeJobData;
  }

  const depositRequest: DepositRequest = JSON.parse(
    jobData.data.depositRequestJson
  );

  const assetAddr = AssetTrait.decode(depositRequest.encodedAsset).assetAddr;
  return deps.waitEstimator.estimateWaitTimeSeconds(
    queueType,
    assetAddr,
    delayInCurrentQueue
  );
}

interface EstimateProspectiveWaitDeps {
  screeningApi: ScreeningApi;
  screenerDelayCalculator: ScreenerDelayCalculator;
  waitEstimator: WaitEstimator;
}

// NOTE: This function can throw error
export async function estimateWaitTimeSecondsForProspective(
  deps: EstimateProspectiveWaitDeps,
  spender: Address,
  assetAddr: Address,
  value: bigint
): Promise<number> {
  const passesScreen = await deps.screeningApi.isSafeDepositRequest(
    spender,
    assetAddr,
    value
  );

  if (!passesScreen) {
    throw new Error(
      `Prospective deposit request failed screening. spender: ${spender}. assetAddr: ${assetAddr}, value: ${value}`
    );
  }

  const screenerDelay =
    await deps.screenerDelayCalculator.calculateDelaySeconds(
      spender,
      assetAddr,
      value
    );

  const additionalWaitTime = await deps.waitEstimator.estimateWaitTimeSeconds(
    QueueType.Screener,
    assetAddr,
    screenerDelay
  );

  return screenerDelay + additionalWaitTime;
}
