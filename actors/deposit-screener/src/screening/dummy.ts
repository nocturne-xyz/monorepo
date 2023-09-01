import { ScreeningCheckerApi, ScreeningDepositRequest } from ".";

export const MAGIC_REJECTION_VALUE = 30303000000000000n; // 0.030303

export class DummyScreeningApi implements ScreeningCheckerApi {
  async checkDeposit({
    // TODO make this with new return type; need to see what delay should be added
    spender,
    assetAddr,
    value,
  }: ScreeningDepositRequest): Promise<boolean> {
    spender;
    assetAddr;
    if (process.env.ENVIRONMENT === "production") return false;
    return value !== MAGIC_REJECTION_VALUE;
  }
}
