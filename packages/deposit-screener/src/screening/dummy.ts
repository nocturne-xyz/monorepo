import { Address } from "@nocturne-xyz/sdk";
import { ScreeningApi } from ".";

export class DummyScreeningApi implements ScreeningApi {
  async validDepositRequest(
    spender: Address,
    assetAddr: Address,
    value: bigint
  ): Promise<boolean> {
    spender;
    assetAddr;
    value;
    return true;
  }
}
