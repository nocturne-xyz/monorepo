import { Address, Asset } from "@nocturne-xyz/sdk";

export interface ScreenerDelayCalculator {
  calculateDelaySeconds(
    spender: Address,
    asset: Asset,
    value: bigint
  ): Promise<number>;
}

export { DummyScreenerDelayCalculator } from "./dummy";
