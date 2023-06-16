import { Address } from "@nocturne-xyz/sdk";

export class DummyScreenerDelayCalculator {
  delaySeconds = 0;

  constructor(delaySeconds?: number) {
    if (delaySeconds) {
      this.delaySeconds = delaySeconds;
    }
  }

  async calculateDelaySeconds(
    spender: Address,
    assetAddr: Address,
    value: bigint
  ): Promise<number> {
    spender;
    assetAddr;
    value;

    const twentyPercentOfDelay = this.delaySeconds / 5;
    return (
      this.delaySeconds -
      (Math.random() * 2 * twentyPercentOfDelay - twentyPercentOfDelay)
    );
  }
}
