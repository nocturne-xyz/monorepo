import { Address } from "@nocturne-xyz/core";

export interface ScreeningApi {
  isSafeDepositRequest(
    spender: Address,
    assetAddr: Address,
    value: bigint
  ): Promise<boolean>;
}

export { DummyScreeningApi } from "./dummy";
