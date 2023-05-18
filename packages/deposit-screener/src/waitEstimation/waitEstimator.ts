import { Queue } from "bullmq";
import { DepositScreenerDB } from "../db";
import { DepositRequestJobData, DepositRequestStatus } from "../types";
import { Logger } from "winston";
import { Address, AssetTrait, DepositRequest } from "@nocturne-xyz/sdk";
import { ScreenerDelayCalculator } from "../screenerDelay";
import { hashDepositRequest } from "../typedData";
import { ScreeningApi } from "../screening";

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
  fulfillerQueue: Queue<DepositRequestJobData>;
}

export async function estimateWaitTimeSecondsForExisting(
  deps: EstimateExistingWaitDeps,
  depositRequest: DepositRequest
): Promise<number | undefined> {
  const depositHash = hashDepositRequest(depositRequest);
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
