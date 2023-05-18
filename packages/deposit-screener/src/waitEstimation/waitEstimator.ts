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

export async function estimateWaitTimeSecondsForExisting(
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
  let jobData: Job<DepositRequestJobData, any, string>;
  if (queueType == QueueType.Screener) {
    const maybeJobData = await deps.screenerQueue.getJob(depositHash);
    if (!maybeJobData) {
      deps.logger.warn(
        `Could not find job in screener queue for deposit hash ${depositHash}`
      );
      return undefined;
    }
    delayInCurrentQueue = maybeJobData.delay;
    jobData = maybeJobData;
  } else {
    const depositRequest = await deps.db.getDepositRequest(depositHash);
    if (!depositRequest) {
      return undefined;
    }

    const assetAddr = AssetTrait.decode(depositRequest.encodedAsset).assetAddr;
    const fulfillerQueue = deps.fulfillerQueues.get(assetAddr);
    if (!fulfillerQueue) {
      deps.logger.error(`No fulfiller queue for asset ${assetAddr}`);
      return undefined;
    }

    const maybeJobData = await fulfillerQueue.getJob(depositHash);
    if (!maybeJobData) {
      deps.logger.warn(
        `Could not find job in screener queue for deposit hash ${depositHash}`
      );
      return undefined;
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

export async function estimateWaitTimeSecondsForProspective(
  deps: EstimateProspectiveWaitDeps,
  spender: Address,
  assetAddr: Address,
  value: bigint
): Promise<number | undefined> {
  const passesScreen = await deps.screeningApi.validDepositRequest(
    spender,
    assetAddr,
    value
  );

  if (!passesScreen) {
    return undefined;
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
