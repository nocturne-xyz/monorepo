import { DepositManager } from "@nocturne-xyz/contracts";
import { DepositRequest } from "@nocturne-xyz/sdk";
import { DepositScreenerDB } from "./db";
import { DepositRequestStage } from "./types";
import { ScreeningApi } from "./screening";

interface CheckDepositRequestDeps {
  depositManagerContract: DepositManager;
  screeningApi: ScreeningApi; // chainalysis, TRM, etc
  db: DepositScreenerDB; // track rate limits
}

// TODO: fill with real implementation
export async function checkDepositRequest(
  deposit: DepositRequest,
  deps: CheckDepositRequestDeps
): Promise<DepositRequestStage> {
  deposit;
  deps;
  return DepositRequestStage.PassedScreen;
}
