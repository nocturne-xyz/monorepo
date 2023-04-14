import { DepositManager } from "@nocturne-xyz/contracts";
import { DepositRequest } from "@nocturne-xyz/sdk";
import { DepositScreenerDB } from "./db";
import { DepositRequestStatus } from "./types";
import { ScreeningApi } from "./screening";
import { Logger } from "winston";

interface CheckDepositRequestDeps {
  depositManagerContract: DepositManager;
  screeningApi: ScreeningApi; // chainalysis, TRM, etc
  db: DepositScreenerDB; // track rate limits
}

// TODO: fill with real implementation
export async function checkDepositRequest(
  logger: Logger,
  deposit: DepositRequest,
  deps: CheckDepositRequestDeps
): Promise<DepositRequestStatus> {
  logger;
  deposit;
  deps;
  return DepositRequestStatus.PassedScreen;
}
