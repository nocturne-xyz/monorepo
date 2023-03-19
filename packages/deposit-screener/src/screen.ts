import { DepositManager } from "@nocturne-xyz/contracts";
import { DepositRequest } from "@nocturne-xyz/sdk";
import { RateLimitDB } from "./db";
import { DepositRequestStage } from "./types";
import { ScreeningApi } from "./screening";

interface ScreenDepositRequestDeps {
  depositManagerContract: DepositManager;
  screeningApi: ScreeningApi; // chainalysis, TRM, etc
  rateLimitDB: RateLimitDB; // track rate limits
}

// TODO: fill with real implementation
export async function screenDepositRequest(
  deposit: DepositRequest,
  deps: ScreenDepositRequestDeps
): Promise<DepositRequestStage> {
  deposit;
  deps;
  return DepositRequestStage.PassedScreen;
}
