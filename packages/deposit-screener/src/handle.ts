import { DepositManager } from "@nocturne-xyz/contracts";
import { DepositRequest } from "@nocturne-xyz/sdk";
import { Queue } from "bullmq";
import { checkDepositRequest } from "./check";
import { DepositScreenerDB } from "./db";
import { enqueueDepositRequest } from "./enqueue";
import { ScreeningApi } from "./screening";
import { DepositRequestStage } from "./types";

interface HandleDepositRequestDeps {
  depositManagerContract: DepositManager;
  screeningApi: ScreeningApi;
  db: DepositScreenerDB;
  delayQueue: Queue;
}

export async function handleDepositRequest(
  depositRequest: DepositRequest,
  deps: HandleDepositRequestDeps
): Promise<DepositRequestStage> {
  const stage = await checkDepositRequest(depositRequest, { ...deps });

  if (stage == DepositRequestStage.PassedScreen) {
    await enqueueDepositRequest(depositRequest, { ...deps });
    return DepositRequestStage.Enqueued;
  } else {
    return stage;
  }
}
