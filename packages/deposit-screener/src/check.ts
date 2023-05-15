import { DepositManager } from "@nocturne-xyz/contracts";
import { DepositRequest } from "@nocturne-xyz/sdk";
import { DepositScreenerDB } from "./db";
import { ScreeningApi } from "./screening";
import { Logger } from "winston";

interface CheckDepositRequestDeps {
  depositManagerContract: DepositManager;
  screeningApi: ScreeningApi; // chainalysis, TRM, etc
  db: DepositScreenerDB; // track rate limits
}

export interface CheckDepositRequestResult {
  isSafe: boolean;
  reason?: string;
}

// TODO: fill with real implementation
// returns undefined if deposit is safe, otherwise returns a reason why not
export async function checkDepositRequest(
  logger: Logger,
  deposit: DepositRequest,
  deps: CheckDepositRequestDeps
): Promise<CheckDepositRequestResult> {
  logger;
  deposit;
  deps;
  return { isSafe: true };
}
