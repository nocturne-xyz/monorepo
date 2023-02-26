import {
  PreSignJoinSplit,
  NoteTrait,
  computeOperationDigest,
  PreSignOperation,
  PreProofJoinSplit,
  SignedOperation,
} from "./primitives";
import { JoinSplitInputs } from "./proof";
import { NocturneSignature, NocturneSigner } from "./crypto";

export class OpSigner {
  private readonly signer: NocturneSigner;

  constructor(signer: NocturneSigner) {
    this.signer = signer;
  }

  signOperation(op: PreSignOperation): SignedOperation {
    const opDigest = computeOperationDigest(op);
    const opSig = this.signer.sign(opDigest);

    const joinSplits: PreProofJoinSplit[] = op.joinSplits.map((joinSplit) =>
      this.makePreProofJoinSplit(joinSplit, opDigest, opSig)
    );

    const {
      actions,
      refundAddr,
      encodedRefundAssets,
      encodedGasAsset,
      executionGasLimit,
      gasPrice,
      maxNumRefunds,
    } = op;

    return {
      joinSplits,
      refundAddr,
      encodedRefundAssets,
      actions,
      encodedGasAsset,
      executionGasLimit,
      gasPrice,
      maxNumRefunds,
    };
  }

  private makePreProofJoinSplit(
    preProofJoinSplit: PreSignJoinSplit,
    opDigest: bigint,
    opSig: NocturneSignature
  ): PreProofJoinSplit {
    const {
      merkleProofA,
      merkleProofB,
      oldNoteA,
      oldNoteB,
      newNoteA,
      newNoteB,
      ...baseJoinSplit
    } = preProofJoinSplit;

    const { c, z } = opSig;

    const { x, y } = this.signer.spendPk;

    const proofInputs: JoinSplitInputs = {
      vk: this.signer.vk,
      spendPk: [x, y],
      c,
      z,
      merkleProofA,
      merkleProofB,
      operationDigest: opDigest,
      oldNoteA: NoteTrait.encode(oldNoteA),
      oldNoteB: NoteTrait.encode(oldNoteB),
      newNoteA: NoteTrait.encode(newNoteA),
      newNoteB: NoteTrait.encode(newNoteB),
    };
    return {
      opDigest,
      proofInputs,
      ...baseJoinSplit,
    };
  }
}
