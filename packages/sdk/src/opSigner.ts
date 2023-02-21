import { NocturneSignature, NocturneSigner } from "./crypto";
import { NoteTrait } from "./note";
import { computeOperationDigest } from "./contract";
import {
  PreProofJoinSplit,
  PreSignOperation,
  SignedJoinSplit,
  SignedOperation,
} from "./commonTypes";
import { JoinSplitInputs } from "./proof";

export class OpSigner {
  private readonly signer: NocturneSigner;

  constructor(signer: NocturneSigner) {
    this.signer = signer;
  }

  signOperation(op: PreSignOperation): SignedOperation {
    const opDigest = computeOperationDigest(op);
    const opSig = this.signer.sign(opDigest);

    const joinSplits: SignedJoinSplit[] = op.joinSplits.map((joinSplit) =>
      this.makePreProofJoinSplit(joinSplit, opDigest, opSig)
    );

    const {
      actions,
      refundAddr,
      encodedRefundAssets,
      verificationGasLimit,
      executionGasLimit,
      gasPrice,
      maxNumRefunds,
    } = op;

    return {
      joinSplits,
      refundAddr,
      encodedRefundAssets,
      actions,
      verificationGasLimit,
      executionGasLimit,
      gasPrice,
      maxNumRefunds,
    };
  }

  private makePreProofJoinSplit(
    preProofJoinSplit: PreProofJoinSplit,
    opDigest: bigint,
    opSig: NocturneSignature
  ): SignedJoinSplit {
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
