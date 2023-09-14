import {
  PreSignJoinSplit,
  NoteTrait,
  PreSignOperation,
  PreProofJoinSplit,
  SignedOperation,
  computeOperationDigest,
} from "./primitives";
import { JoinSplitInputs } from "./proof";
import { NocturneSignature, NocturneSigner } from "./crypto";
import { encodeEncodedAssetAddrWithSignBitsPI } from "./proof/joinsplit";
import { toSignableOperation } from "./primitives/operation";

export function signOperation(
  signer: NocturneSigner,
  op: PreSignOperation
): SignedOperation {
  const opDigest = computeOperationDigest(toSignableOperation(op));
  const opSig = signer.sign(opDigest);

  const joinSplits: PreProofJoinSplit[] = op.joinSplits.map((joinSplit) =>
    makePreProofJoinSplit(signer, joinSplit, opDigest, opSig)
  );

  const {
    networkInfo,
    actions,
    refundAddr,
    refunds,
    encodedGasAsset,
    gasAssetRefundThreshold,
    executionGasLimit,
    gasPrice,
    deadline,
    atomicActions,
  } = op;

  return {
    networkInfo,
    joinSplits,
    refundAddr,
    refunds,
    actions,
    encodedGasAsset,
    gasAssetRefundThreshold,
    executionGasLimit,
    gasPrice,
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
    publicSpend,
    ...baseJoinSplit
  } = preProofJoinSplit;

  const { c, z } = opSig;

  const { x, y } = signer.spendPk;

  const encodedOldNoteA = NoteTrait.encode(oldNoteA);
  const encodedOldNoteB = NoteTrait.encode(oldNoteB);
  const encodedNewNoteA = NoteTrait.encode(newNoteA);
  const encodedNewNoteB = NoteTrait.encode(newNoteB);

  // if publicSpend is 0, hide the asset info by masking it to 0
  const pubEncodedAssetAddrWithSignBits = encodeEncodedAssetAddrWithSignBitsPI(
    publicSpend === 0n ? 0n : encodedNewNoteA.encodedAssetAddr,
    refundAddr
  );
  const pubEncodedAssetId =
    publicSpend === 0n ? 0n : encodedNewNoteA.encodedAssetId;

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
    pubEncodedAssetAddrWithSignBits,
    pubEncodedAssetId,
  };

  return {
    opDigest,
    proofInputs,
    refundAddr,
    senderCommitment,
    publicSpend,
    ...baseJoinSplit,
  };
}
