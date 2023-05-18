import { Address } from "@nocturne-xyz/sdk";

export interface ScreeningApi {
  validDepositRequest(
    spender: Address,
    assetAddr: Address,
    value: bigint
  ): Promise<boolean>;
}

export { DummyScreeningApi } from "./dummy";
