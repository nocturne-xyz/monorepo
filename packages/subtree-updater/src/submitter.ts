import { Accountant } from "@nocturne-xyz/contracts";
import { BaseProof, packToSolidityProof } from "@nocturne-xyz/sdk";

export interface SubtreeUpdateSubmitter {
  submitProof(
    proof: BaseProof,
    newRoot: bigint,
    subtreeIndex: number
  ): Promise<void>;
  dropDB(): Promise<void>;
}

// Default implementation of `SubtreeUpdateSubmitter` that just sits there and waits
// for the TX to confirm.
export class SyncSubtreeSubmitter implements SubtreeUpdateSubmitter {
  accountantContract: Accountant;

  constructor(accountantContract: Accountant) {
    this.accountantContract = accountantContract;
  }

  async submitProof(proof: BaseProof, newRoot: bigint): Promise<void> {
    const solidityProof = packToSolidityProof(proof);
    try {
      const tx = await this.accountantContract.applySubtreeUpdate(
        newRoot,
        solidityProof
      );
      await tx.wait();
    } catch (err: any) {
      // ignore errors that are due to duplicate submissions
      // this can happen if there are multiple instances of subtree updaters running
      if (!err.toString().includes("newRoot already a past root")) {
        throw err;
      }
    }
  }

  async dropDB(): Promise<void> {}
}
