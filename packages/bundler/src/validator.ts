import { ethers, providers } from "ethers";
import IORedis from "ioredis";
import {
  Bundle,
  computeOperationDigest,
  ProvenOperation,
} from "@nocturne-xyz/sdk";
import { Wallet__factory, Wallet } from "@nocturne-xyz/contracts";
import { NullifierDB, RedisTransaction } from "./db";
import { ErrString } from "./common";

export class OperationValidator {
  nullifierDB: NullifierDB;
  provider: ethers.providers.Provider;
  walletContract: Wallet;
  ignoreGas: boolean;

  constructor(
    walletAddress: string,
    redis: IORedis,
    provider?: ethers.providers.Provider,
    ignoreGas: boolean = false
  ) {
    this.nullifierDB = new NullifierDB(redis);

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
    this.ignoreGas = ignoreGas;
  }

  async addNullifiers(operation: ProvenOperation): Promise<void> {
    return await this.nullifierDB.addNullifiers(operation);
  }

  getAddNullifiersTransaction(operation: ProvenOperation): RedisTransaction[] {
    return this.nullifierDB.getAddNullifierTransactions(operation);
  }

  async checkNullifierConflictError(
    operation: ProvenOperation
  ): Promise<ErrString | undefined> {
    const opNfSet = new Set<bigint>();

    // Ensure no overlap in given operation
    console.log("Checking in-op conflicts");
    for (const { nullifierA, nullifierB } of operation.joinSplits) {
      if (opNfSet.has(nullifierA)) {
        return `Conflicting nullifier in operation: ${nullifierA}`;
      }
      opNfSet.add(nullifierA);

      if (opNfSet.has(nullifierB)) {
        return `Conflicting nullifier in operation: ${nullifierB}`;
      }
      opNfSet.add(nullifierB);
    }

    // Ensure no overlap with other nfs already in queue
    console.log("Checking in-queue conflicts");
    for (const nf of opNfSet) {
      const conflict = await this.nullifierDB.hasNullifierConflict(nf);
      if (conflict) {
        return `Nullifier already in other operation in queue: ${nf}`;
      }
    }

    return undefined;
  }

  async checkRevertError(
    operation: ProvenOperation
  ): Promise<ErrString | undefined> {
    console.log("submitting operation", operation);

    const opDigest = computeOperationDigest(operation);
    console.log("with digest", opDigest);
    console.log("with joinsplits", operation.joinSplits);

    const id = opDigest.toString();
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

  async checkNotEnoughGasError(
    operation: ProvenOperation
  ): Promise<ErrString | undefined> {
    if (!this.ignoreGas) {
      console.log("checking that operation's gas price >= current chain's gas price");
      const gasPrice = (await this.provider.getGasPrice()).toBigInt();
      if (operation.gasPrice < gasPrice) {
        const id = computeOperationDigest(operation).toString();
        return `Operation ${id} gas price too low: ${operation.gasPrice} < current chain's gas price ${gasPrice}`
      }
    } else {
      console.log("`ignoreGas` set to true - skipping gas price check")
    }

    return undefined;
  }
}
