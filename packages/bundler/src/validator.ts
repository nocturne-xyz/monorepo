import { NullifierSetManager } from "./nullifierSetManager";
import { ethers, providers } from "ethers";
import IORedis from "ioredis";
import { Bundle, ProvenOperation } from "@nocturne-xyz/sdk";
import { Wallet__factory, Wallet } from "@nocturne-xyz/contracts";

export class OperationValidator extends NullifierSetManager {
  signingProvider: ethers.Signer;
  walletContract: Wallet;

  constructor(walletAddress: string, redis: IORedis) {
    super(redis);

    const privateKey = process.env.TX_SIGNER_KEY;
    if (!privateKey) {
      throw new Error("Missing TX_SIGNER_KEY");
    }

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error("Missing RPC_URL");
    }

    const provider = new providers.JsonRpcProvider(rpcUrl);
    this.signingProvider = new ethers.Wallet(privateKey, provider);
    this.walletContract = Wallet__factory.connect(
      walletAddress,
      this.signingProvider
    );
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
    const bundle: Bundle = { operations: [operation] };
    const data = this.walletContract.interface.encodeFunctionData(
      "processBundle",
      [bundle]
    );
    try {
      const est = await this.signingProvider.estimateGas({
        to: this.walletContract.address,
        data,
      });
      console.log("Operation gas estimate: ", est);
      return undefined;
    } catch (e) {
      return `Operation reverts with: ${e}`;
    }
  }
}
