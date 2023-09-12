import { ScreeningCheckerApi, ScreeningDepositRequest } from ".";
import { Delay, Rejection } from "./checks/RuleSet";

export const MAGIC_LONG_DELAY_VALUE = 10101000000000000n; // 0.010101
export const MAGIC_ZERO_DELAY_VALUE = 20202000000000000n; // 0.020202
export const MAGIC_REJECTION_VALUE = 30303000000000000n; // 0.030303

export class DummyScreeningApi implements ScreeningCheckerApi {
  readonly baseDelaySeconds;

  constructor(delaySeconds: number) {
    this.baseDelaySeconds = delaySeconds;
  }

  async checkDeposit({
    spender,
    assetAddr,
    value,
  }: ScreeningDepositRequest): Promise<Rejection | Delay> {
    spender;
    assetAddr;
    if (process.env.ENVIRONMENT === "production") {
      return {
        type: "Rejection",
        reason:
          "DummyScreeningApi auto-rejects deposits in production—this should not be used!",
      };
    }
    if (value === MAGIC_REJECTION_VALUE) {
      return {
        type: "Rejection",
        reason: "Magic Rejection Value was used for this deposit.",
      };
    }
    let delaySeconds;
    if (value === MAGIC_LONG_DELAY_VALUE) {
      delaySeconds = 60 * 60 * 3; // 3 hours
    } else if (value === MAGIC_ZERO_DELAY_VALUE) {
      delaySeconds = 0;
    } else {
      const twentyPercent = this.baseDelaySeconds / 5;
      delaySeconds =
        this.baseDelaySeconds -
        (Math.random() * 2 * twentyPercent - twentyPercent);
    }
    return {
      type: "Delay",
      timeSeconds: delaySeconds,
    };
  }
}
