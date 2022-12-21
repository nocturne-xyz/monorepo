import { NullifierSetManager } from "./nullifierSetManager";
import { ethers, providers } from "ethers";
import IORedis from "ioredis";
import {
  Bundle,
  calculateOperationDigest,
  ProvenOperation,
} from "@nocturne-xyz/sdk";
import { Wallet__factory, Wallet } from "@nocturne-xyz/contracts";

export class OperationValidator extends NullifierSetManager {
  provider: ethers.providers.Provider;
  walletContract: Wallet;

  constructor(
    walletAddress: string,
    redis: IORedis,
    provider?: ethers.providers.Provider
  ) {
    super(redis);

    if (provider) {
      this.provider = provider;
    } else {
      const rpcUrl = process.env.RPC_URL;
      if (!rpcUrl) {
        throw new Error("Missing RPC_URL");
      }
      this.provider = new providers.JsonRpcProvider(rpcUrl);
    }

    this.walletContract = Wallet__factory.connect(walletAddress, this.provider);
  }

  async extractNullifierConflictError(
    operation: ProvenOperation
  ): Promise<string | undefined> {
    const opNfSet = new Set<bigint>();

    // Ensure no overlap in given operation
    console.log("Checking in-op conflicts");
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
    console.log("Checking in-queue conflicts");
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
    const id = calculateOperationDigest(operation).toString();
    const bundle: Bundle = { operations: [operation] };
    const data = this.walletContract.interface.encodeFunctionData(
      "processBundle",
      [bundle]
    );
    try {
      const est = await this.provider.estimateGas({
        to: this.walletContract.address,
        data,
      });
      console.log("Operation gas estimate: ", est);
      return undefined;
    } catch (e) {
      return `Operation with digest ${id} reverts with: ${e}`;
    }
  }
}
