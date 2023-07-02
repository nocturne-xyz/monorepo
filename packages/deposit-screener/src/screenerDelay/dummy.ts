import { Address } from "@nocturne-xyz/sdk";

export class DummyScreenerDelayCalculator {
  normalDelaySeconds = 0;
  readonly magicLongDelayValue = 10101000000000000n; // 0.010101 for 18 decimals
  readonly dummyZeroDelayValue = 20202000000000000n; // 0.020202 for 18 decimals
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

    if (this.magicLongDelayValue && value === this.magicLongDelayValue) {
      return this.longDelaySeconds;
    }

    if (this.dummyZeroDelayValue && value === this.dummyZeroDelayValue) {
      return 0;
    }

    const twentyPercentOfDelay = this.normalDelaySeconds / 5;
    return (
      this.normalDelaySeconds -
      (Math.random() * 2 * twentyPercentOfDelay - twentyPercentOfDelay)
    );
  }
}
