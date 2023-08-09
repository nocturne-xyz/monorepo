import { DepositManager } from "@nocturne-xyz/contracts";
import { DepositRequest } from "@nocturne-xyz/wallet-sdk";
import { Logger } from "winston";
import { DepositScreenerDB } from "./db";
import { ScreeningApi } from "./screening";
import { dummySafeDepositCheck } from "./utils";

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
export async function checkDepositRequest(
  logger: Logger,
  deposit: DepositRequest,
  deps: CheckDepositRequestDeps
): Promise<CheckDepositRequestResult> {
  logger;
  deposit;
  deps;
  return { isSafe: dummySafeDepositCheck(deposit.value) };
}
