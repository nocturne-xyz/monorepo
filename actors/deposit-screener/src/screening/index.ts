import { Address } from "@nocturne-xyz/core";
import { RULESET_V1 } from "./checks/v1/RULESET_V1";
import { Delay, Rejection } from "./checks/RuleSet";

export interface ScreeningDepositRequest {
  spender: Address;
  assetAddr: Address;
  value: bigint;
}
export interface ScreeningCheckerApi {
  checkDeposit(
    depositInfo: ScreeningDepositRequest
  ): Promise<Rejection | Delay>;
}

export class ConcreteScreeningChecker implements ScreeningCheckerApi {
  async checkDeposit(
    depositInfo: ScreeningDepositRequest
  ): Promise<Rejection | Delay> {
    return RULESET_V1.check(depositInfo);
  }
}

export { DummyScreeningApi } from "./dummy";
