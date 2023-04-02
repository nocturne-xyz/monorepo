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

export function signOperation(
  signer: NocturneSigner,
  op: PreSignOperation
): SignedOperation {
  const opDigest = computeOperationDigest(op);
  const opSig = signer.sign(opDigest);

  const joinSplits: PreProofJoinSplit[] = op.joinSplits.map((joinSplit) =>
    makePreProofJoinSplit(signer, joinSplit, opDigest, opSig)
  );

  const {
    actions,
    refundAddr,
    encodedRefundAssets,
    encodedGasAsset,
    executionGasLimit,
    gasPrice,
    maxNumRefunds,
    chainId,
    deadline,
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
    chainId,
    deadline,
  };
}

function makePreProofJoinSplit(
  signer: NocturneSigner,
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

  const { x, y } = signer.spendPk;

  const proofInputs: JoinSplitInputs = {
    vk: signer.vk,
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
