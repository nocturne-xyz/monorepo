import { Address } from "@nocturne-xyz/core";

export interface ScreeningDepositRequest {
  spender: Address;
  assetAddr: Address;
  value: bigint;
}
export interface ScreeningCheckerApi {
  isSafeDepositRequest(
    spender: Address,
    assetAddr: Address,
    value: bigint
  ): Promise<boolean>;
}

// export class ConcreteScreeningChecker implements ScreeningCheckerApi {

// }

export { DummyScreeningApi } from "./dummy";
