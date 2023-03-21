import { DepositRequest } from "@nocturne-xyz/sdk";

export class DummyDelayCalculator {
  async calculateDelaySeconds(depositRequest: DepositRequest): Promise<number> {
    depositRequest;
    return 0;
  }
}
