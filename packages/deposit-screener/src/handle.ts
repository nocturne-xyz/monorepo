import { DepositManager } from "@nocturne-xyz/contracts";
import { DepositRequest } from "@nocturne-xyz/sdk";
import { Queue } from "bullmq";
import { RateLimitDB } from "./db";
import { calculateDelaySeconds } from "./delay";
import { screenDepositRequest } from "./screen";
import { ScreeningApi } from "./screening";
import {
  DelayedDepositJobData,
  DELAYED_DEPOSIT_JOB_TAG,
  DepositRequestStage,
} from "./types";
import * as JSON from "bigint-json-serialization";
import { secsToMillis } from "./utils";

interface HandleDepositRequestDeps {
  depositManagerContract: DepositManager;
  screeningApi: ScreeningApi;
  rateLimitDB: RateLimitDB;
  delayQueue: Queue;
}

export async function handleDepositRequest(
  depositRequest: DepositRequest,
  deps: HandleDepositRequestDeps
): Promise<DepositRequestStage> {
  const stage = await screenDepositRequest(depositRequest, { ...deps });

  if (stage == DepositRequestStage.PassedScreen) {
    const delaySeconds = await calculateDelaySeconds(depositRequest);

    const depositRequestJson = JSON.stringify(depositRequest);
    const jobData: DelayedDepositJobData = {
      depositRequestJson,
    };

    await deps.delayQueue.add(DELAYED_DEPOSIT_JOB_TAG, jobData, {
      delay: secsToMillis(delaySeconds),
    });
    return DepositRequestStage.Enqueued;
  } else {
    return stage; // failed screen
  }
}
