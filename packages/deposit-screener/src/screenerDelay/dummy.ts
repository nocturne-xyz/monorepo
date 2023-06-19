import { Address } from "@nocturne-xyz/sdk";

export class DummyScreenerDelayCalculator {
  normalDelaySeconds: number = 0;
  magicLongDelayValue?: bigint;
  readonly longDelaySeconds = 60 * 60 * 3; // default to 3 hours

  constructor(delaySeconds?: number, magicLongDelayValue?: number) {
    if (delaySeconds) {
      this.normalDelaySeconds = delaySeconds;
    }

    if (magicLongDelayValue) {
      this.magicLongDelayValue = BigInt(magicLongDelayValue);
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

    const twentyPercentOfDelay = this.normalDelaySeconds / 5;
    return (
      this.normalDelaySeconds -
      (Math.random() * 2 * twentyPercentOfDelay - twentyPercentOfDelay)
    );
  }
}
