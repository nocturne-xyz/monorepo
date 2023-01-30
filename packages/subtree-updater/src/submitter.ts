import { Wallet } from "@nocturne-xyz/contracts";
import { BaseProof, packToSolidityProof } from "@nocturne-xyz/sdk";
import { Mutex } from "async-mutex";

export interface SubtreeUpdateSubmitter {
  submitProof(
    proof: BaseProof,
    newRoot: bigint,
    subtreeIndex: number
  ): Promise<void>;
  fillBatch(): Promise<void>;
  dropDB(): Promise<void>;
}

// Default implementation of `SubtreeUpdateSubmitter` that just sits there and waits
// for the TX to confirm.
export class SyncSubtreeSubmitter implements SubtreeUpdateSubmitter {
  walletContract: Wallet;

  // HACK: use a mutex to prevent nonces from colliding
  mutex: Mutex;

  constructor(walletContract: Wallet) {
    this.walletContract = walletContract;
    this.mutex = new Mutex();
  }

  async submitProof(proof: BaseProof, newRoot: bigint): Promise<void> {
    const solidityProof = packToSolidityProof(proof);
    try {
      console.log("submitting tx...");
      const tx = await this.mutex.runExclusive(() =>
        this.walletContract.applySubtreeUpdate(newRoot, solidityProof)
      );
      await tx.wait();
      console.log("successfully updated root to", newRoot);
    } catch (err: any) {
      // ignore errors that are due to duplicate submissions
      // this can happen if there are multiple instances of subtree updaters running
      if (!err.toString().includes("newRoot already a past root")) {
        console.error("error submitting proof:", err);
        throw err;
      }
      console.log("update already submitted by another agent");
    }
  }

  async fillBatch(): Promise<void> {
    await this.mutex.runExclusive(() =>
      this.walletContract.fillBatchWithZeros()
    );
  }

  async dropDB(): Promise<void> {}
}
