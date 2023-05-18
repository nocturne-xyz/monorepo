import { Address, Asset } from "@nocturne-xyz/sdk";

export class DummyScreenerDelayCalculator {
  async calculateDelaySeconds(
    spender: Address,
    asset: Asset,
    value: bigint
  ): Promise<number> {
    spender;
    asset;
    value;
    return 0;
  }
}
