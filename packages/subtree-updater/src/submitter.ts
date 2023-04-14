import { Handler } from "@nocturne-xyz/contracts";
import { BaseProof, packToSolidityProof } from "@nocturne-xyz/sdk";
import { Logger } from "winston";

export interface SubtreeUpdateSubmitter {
  submitProof(logger: Logger, proof: BaseProof, newRoot: bigint): Promise<void>;
  fillBatch(): Promise<void>;
  dropDB(): Promise<void>;
}

// Default implementation of `SubtreeUpdateSubmitter` that just sits there and waits
// for the TX to confirm.
export class SyncSubtreeSubmitter implements SubtreeUpdateSubmitter {
  handlerContract: Handler;

  constructor(handlerContract: Handler) {
    this.handlerContract = handlerContract;
  }

  async submitProof(
    logger: Logger,
    proof: BaseProof,
    newRoot: bigint
  ): Promise<void> {
    const solidityProof = packToSolidityProof(proof);
    try {
      logger.info("submitting tx...");
      const tx = await this.handlerContract.applySubtreeUpdate(
        newRoot,
        solidityProof
      );
      logger.info("waiting for confirmation...");
      await tx.wait(1);

      logger.info("successfully updated root to", newRoot);
    } catch (err: any) {
      // ignore errors that are due to duplicate submissions
      // this can happen if there are multiple instances of subtree updaters running
      if (!err.toString().includes("newRoot already a past root")) {
        logger.error("error submitting proof:", err);
        throw err;
      }
      logger.warn("update already submitted by another agent");
    }
  }

  async fillBatch(): Promise<void> {
    const tx = await this.handlerContract.fillBatchWithZeros();
    await tx.wait(1);
  }

  async dropDB(): Promise<void> {}
}
