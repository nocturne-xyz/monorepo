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
import { encodeEncodedAssetAddrWithSignBitsPI } from "./proof/joinsplit";

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
    gasAssetRefundThreshold,
    executionGasLimit,
    gasPrice,
    maxNumRefunds,
    chainId,
    deadline,
    atomicActions,
  } = op;

  return {
    joinSplits,
    refundAddr,
    encodedRefundAssets,
    actions,
    encodedGasAsset,
    gasAssetRefundThreshold,
    executionGasLimit,
    gasPrice,
    maxNumRefunds,
    chainId,
    deadline,
    atomicActions,
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
    receiver,
    refundAddr,
    senderCommitment,
    ...baseJoinSplit
  } = preProofJoinSplit;

  const { c, z } = opSig;

  const { x, y } = signer.spendPk;

  const encodedOldNoteA = NoteTrait.encode(oldNoteA);
  const encodedOldNoteB = NoteTrait.encode(oldNoteB);
  const encodedNewNoteA = NoteTrait.encode(newNoteA);
  const encodedNewNoteB = NoteTrait.encode(newNoteB);

  const proofInputs: JoinSplitInputs = {
    vk: signer.vk,
    vkNonce: signer.vkNonce,
    spendPk: [x, y],
    c,
    z,
    merkleProofA,
    merkleProofB,
    operationDigest: opDigest,
    oldNoteA: encodedOldNoteA,
    oldNoteB: encodedOldNoteB,
    newNoteA: encodedNewNoteA,
    newNoteB: encodedNewNoteB,
    refundAddr,
    encodedAssetAddrWithSignBitsPub: encodeEncodedAssetAddrWithSignBitsPI(
      encodedNewNoteA.encodedAssetAddr,
      refundAddr
    ),
  };

  return {
    opDigest,
    proofInputs,
    refundAddr,
    senderCommitment,
    ...baseJoinSplit,
  };
}
