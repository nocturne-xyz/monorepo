import { DepositRequest } from "@nocturne-xyz/sdk";
import { Queue } from "bullmq";
import { calculateDelaySeconds } from "./delay";
import {
  DelayedDepositJobData,
  DELAYED_DEPOSIT_JOB_TAG,
  DepositRequestStatus,
} from "./types";
import * as JSON from "bigint-json-serialization";
import { secsToMillis } from "./utils";

interface EnqueueDepositRequestDeps {
  delayQueue: Queue;
}

export async function enqueueDepositRequest(
  depositRequest: DepositRequest,
  deps: EnqueueDepositRequestDeps
): Promise<DepositRequestStatus> {
  const delaySeconds = await calculateDelaySeconds(depositRequest);

  const depositRequestJson = JSON.stringify(depositRequest);
  const jobData: DelayedDepositJobData = {
    depositRequestJson,
  };

  await deps.delayQueue.add(DELAYED_DEPOSIT_JOB_TAG, jobData, {
    delay: secsToMillis(delaySeconds),
  });
  return DepositRequestStatus.Enqueued;
}
