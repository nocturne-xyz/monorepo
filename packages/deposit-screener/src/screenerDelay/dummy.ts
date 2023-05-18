import { Address } from "@nocturne-xyz/sdk";

export class DummyScreenerDelayCalculator {
  async calculateDelaySeconds(
    spender: Address,
    assetAddr: Address,
    value: bigint
  ): Promise<number> {
    spender;
    assetAddr;
    value;
    return 0;
  }
}
