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

  async extractNullifierConflictError(
    operation: ProvenOperation
  ): Promise<string | undefined> {
    const opNfSet = new Set<bigint>();

    // Ensure no overlap in given operation
    operation.joinSplitTxs.forEach(({ nullifierA, nullifierB }) => {
      if (opNfSet.has(nullifierA)) {
        return `Conflicting nullifier in operation: ${nullifierA}`;
      }
      opNfSet.add(nullifierA);

      if (opNfSet.has(nullifierB)) {
        return `Conflicting nullifier in operation: ${nullifierB}`;
      }
      opNfSet.add(nullifierB);
    });

    // Ensure no overlap with other nfs already in queue
    for (const nf of opNfSet) {
      const conflict = await this.hasNullifierConflict(nf);
      if (conflict) {
        return `Nullifier already in other operation in queue: ${nf}`;
      }
    }

    return undefined;
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
