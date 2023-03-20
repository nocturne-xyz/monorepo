import { DepositRequest } from "@nocturne-xyz/sdk";

export interface DelayCalculator {
  calculateDelaySeconds(depositRequest: DepositRequest): Promise<number>;
}

export { DummyDelayCalculator } from "./dummy";
