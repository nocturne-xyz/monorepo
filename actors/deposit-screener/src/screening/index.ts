import { Address } from "@nocturne-xyz/core";
import { RULESET_V1 } from "./checks/v1/RULESET_V1";
import { Delay, Rejection, RuleSet } from "./checks/RuleSet";
import IORedis from "ioredis";
import { CachedFetchOptions } from "@nocturne-xyz/offchain-utils";

export interface ScreeningDepositRequest {
  spender: Address;
  assetAddr: Address;
  value: bigint;
}

export interface ScreeningCheckerApi {
  checkDeposit(
    depositInfo: ScreeningDepositRequest,
    cachedFetchOptions?: CachedFetchOptions
  ): Promise<Rejection | Delay>;
}

export class ConcreteScreeningChecker implements ScreeningCheckerApi {
  private ruleset: RuleSet;

  constructor(redis: IORedis) {
    this.ruleset = RULESET_V1(redis);
  }

  async checkDeposit(
    depositInfo: ScreeningDepositRequest,
    cachedFetchOptions: CachedFetchOptions = {}
  ): Promise<Rejection | Delay> {
    return this.ruleset.check(depositInfo, cachedFetchOptions);
  }
}

export { DummyScreeningApi } from "./dummy";
