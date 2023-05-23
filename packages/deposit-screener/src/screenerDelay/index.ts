import { Address } from "@nocturne-xyz/sdk";

export interface ScreenerDelayCalculator {
  calculateDelaySeconds(
    spender: Address,
    assetAddr: Address,
    value: bigint
  ): Promise<number>;
}

export { DummyScreenerDelayCalculator } from "./dummy";
