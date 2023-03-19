import { DepositManager } from "@nocturne-xyz/contracts";
import { DepositRequest } from "@nocturne-xyz/sdk";
import { Queue } from "bullmq";
import { checkDepositRequest } from "./check";
import { DepositScreenerDB } from "./db";
import { enqueueDepositRequest } from "./enqueue";
import { ScreeningApi } from "./screening";
import { DepositRequestStatus } from "./types";

interface HandleDepositRequestDeps {
  depositManagerContract: DepositManager;
  screeningApi: ScreeningApi;
  db: DepositScreenerDB;
  delayQueue: Queue;
}

export async function handleDepositRequest(
  depositRequest: DepositRequest,
  deps: HandleDepositRequestDeps
): Promise<DepositRequestStatus> {
  const status = await checkDepositRequest(depositRequest, { ...deps });

  if (status == DepositRequestStatus.PassedScreen) {
    await enqueueDepositRequest(depositRequest, { ...deps });
    return DepositRequestStatus.Enqueued;
  } else {
    return status;
  }
}
