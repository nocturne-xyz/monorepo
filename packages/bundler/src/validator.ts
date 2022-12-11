import { NullifierSetManager } from "./nullifierSetManager";
import { providers } from "ethers";
import IORedis from "ioredis";
import { ProvenOperation } from "@nocturne-xyz/sdk";

export class OperationValidator extends NullifierSetManager {
  provider: providers.JsonRpcProvider;

  constructor(rpcUrl: string, redis: IORedis) {
    super(redis);
    this.provider = new providers.JsonRpcProvider(rpcUrl);
  }

  async extractRevertError(
    operation: ProvenOperation
  ): Promise<string | undefined> {
    for (const action of operation.actions) {
      try {
        await this.provider.estimateGas({
          to: action.contractAddress,
          data: action.encodedFunction,
        });
        return undefined;
      } catch (e) {
        return `Action has reverting call: ${e}`;
      }
    }
  }
}
