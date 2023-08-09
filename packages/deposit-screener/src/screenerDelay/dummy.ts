import { Address } from "@nocturne-xyz/wallet-sdk";
import { MAGIC_LONG_DELAY_VALUE, MAGIC_ZERO_DELAY_VALUE } from "../utils";

export class DummyScreenerDelayCalculator {
  normalDelaySeconds = 0;
  readonly longDelaySeconds = 60 * 60 * 3; // default to 3 hours

  constructor(delaySeconds?: number) {
    if (delaySeconds) {
      this.normalDelaySeconds = delaySeconds;
    }
  }

  async calculateDelaySeconds(
    spender: Address,
    assetAddr: Address,
    value: bigint
  ): Promise<number> {
    spender;
    assetAddr;

    if (value === MAGIC_LONG_DELAY_VALUE) {
      return this.longDelaySeconds;
    }

    if (value === MAGIC_ZERO_DELAY_VALUE) {
      return 0;
    }

    const twentyPercentOfDelay = this.normalDelaySeconds / 5;
    return (
      this.normalDelaySeconds -
      (Math.random() * 2 * twentyPercentOfDelay - twentyPercentOfDelay)
    );
  }
}
