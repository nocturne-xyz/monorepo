import { Address } from "@nocturne-xyz/sdk";
import { ScreeningApi } from ".";

export class DummyScreeningApi implements ScreeningApi {
  magicRejectionValue = 30303000000000000n; // 0.030303 for 18 decimals

  async isSafeDepositRequest(
    spender: Address,
    assetAddr: Address,
    value: bigint
  ): Promise<boolean> {
    spender;
    assetAddr;

    if (this.magicRejectionValue && value === this.magicRejectionValue) {
      return false;
    }

    return true;
  }
}
