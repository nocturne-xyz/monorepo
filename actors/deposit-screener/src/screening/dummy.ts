import { Address } from "@nocturne-xyz/core";
import { ScreeningCheckerApi } from ".";

export const MAGIC_REJECTION_VALUE = 30303000000000000n; // 0.030303

export class DummyScreeningApi implements ScreeningCheckerApi {
  async isSafeDepositRequest(
    spender: Address,
    assetAddr: Address,
    value: bigint
  ): Promise<boolean> {
    spender;
    assetAddr;

    const env = process.env.ENVIRONMENT;
    if (env === "production") return false;
    return value !== MAGIC_REJECTION_VALUE;
  }
}
