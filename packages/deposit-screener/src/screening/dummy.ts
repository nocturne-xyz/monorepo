import { Address } from "@nocturne-xyz/sdk";
import { ScreeningApi } from ".";

export class DummyScreeningApi implements ScreeningApi {
  magicRejectionValue: bigint;

  constructor(magicRejectionValue: number) {
    this.magicRejectionValue = BigInt(magicRejectionValue);
  }

  async isSafeDepositRequest(
    spender: Address,
    assetAddr: Address,
    value: bigint
  ): Promise<boolean> {
    spender;
    assetAddr;

    if (value === this.magicRejectionValue) {
      return false;
    }

    return true;
  }
}
