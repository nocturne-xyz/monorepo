import { Address } from "@nocturne-xyz/wallet-sdk";
import { ScreeningApi } from ".";
import { dummySafeDepositCheck } from "../utils";

export class DummyScreeningApi implements ScreeningApi {
  async isSafeDepositRequest(
    spender: Address,
    assetAddr: Address,
    value: bigint
  ): Promise<boolean> {
    spender;
    assetAddr;
    return dummySafeDepositCheck(value);
  }
}
