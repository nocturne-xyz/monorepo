import { Address } from "@nocturne-xyz/core";

export interface ScreenerDelayCalculator {
  calculateDelaySeconds(
    spender: Address,
    assetAddr: Address,
    value: bigint
  ): Promise<number>;
}

export { DummyScreenerDelayCalculator } from "./dummy";
