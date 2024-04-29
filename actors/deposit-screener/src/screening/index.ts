import { Address } from "@nocturne-xyz/core";
import { RULESET_V1 } from "./checks/v1/RULESET_V1";
import { Accept, Delay, Rejection, RuleSet } from "./checks/RuleSet";
import IORedis from "ioredis";
import { CachedFetchOptions } from "@nocturne-xyz/offchain-utils";
import { requireApiKeys } from "../utils";
import { Logger } from "winston";

export interface ScreeningDepositRequest {
  spender: Address;
  assetAddr: Address;
  value: bigint;
}

export interface ScreeningCheckerApi {
  checkDeposit(
    depositInfo: ScreeningDepositRequest,
    cachedFetchOptions?: CachedFetchOptions
  ): Promise<Rejection | Delay | Accept>;
}

export class ConcreteScreeningChecker implements ScreeningCheckerApi {
  private ruleset: RuleSet;

  constructor(redis: IORedis, logger: Logger) {
    requireApiKeys();
    this.ruleset = RULESET_V1(redis, logger);
  }

  async checkDeposit(
    depositInfo: ScreeningDepositRequest
  ): Promise<Rejection | Delay | Accept> {
    return this.ruleset.check(depositInfo);
  }
}

export { DummyScreeningApi } from "./dummy";
