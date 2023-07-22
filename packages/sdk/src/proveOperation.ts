import { decomposeCompressedPoint } from "./crypto";
import {
  PreProofJoinSplit,
  SignedOperation,
  ProvenJoinSplit,
  ProvenOperation,
} from "./primitives";
import {
  JoinSplitProver,
  joinSplitPublicSignalsFromArray,
  packToSolidityProof,
} from "./proof";

export async function proveOperation(
  prover: JoinSplitProver,
  op: SignedOperation
): Promise<ProvenOperation> {
  const joinSplits: ProvenJoinSplit[] = await Promise.all(
    op.joinSplits.map((joinSplit) => proveJoinSplit(prover, joinSplit))
  );

  const {
    networkInfo,
    refundAddr,
    encodedRefundAssets,
    actions,
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
    encodedRefundAssets,
    actions,
    encodedGasAsset,
    gasAssetRefundThreshold,
    executionGasLimit,
    gasPrice,
    deadline,
    atomicActions,
  };
}

async function proveJoinSplit(
  prover: JoinSplitProver,
  signedJoinSplit: PreProofJoinSplit
): Promise<ProvenJoinSplit> {
  const {
    opDigest,
    proofInputs,
    refundAddr,
    senderCommitment,
    ...baseJoinSplit
  } = signedJoinSplit;
  console.log("proving joinSplit", { proofInputs });

  const proof = await prover.proveJoinSplit(proofInputs);

  const [, refundAddrH1CompressedY] = decomposeCompressedPoint(refundAddr.h1);
  const [, refundAddrH2CompressedY] = decomposeCompressedPoint(refundAddr.h2);

  // Check that snarkjs output is consistent with our precomputed joinsplit values
  const publicSignals = joinSplitPublicSignalsFromArray(proof.publicSignals);
  if (
    baseJoinSplit.newNoteACommitment !== publicSignals.newNoteACommitment ||
    baseJoinSplit.newNoteBCommitment !== publicSignals.newNoteBCommitment ||
    baseJoinSplit.commitmentTreeRoot !== publicSignals.commitmentTreeRoot ||
    baseJoinSplit.publicSpend !== publicSignals.publicSpend ||
    baseJoinSplit.nullifierA !== publicSignals.nullifierA ||
    baseJoinSplit.nullifierB !== publicSignals.nullifierB ||
    opDigest !== publicSignals.opDigest ||
    refundAddrH1CompressedY !== publicSignals.refundAddrH1CompressedY ||
    refundAddrH2CompressedY !== publicSignals.refundAddrH2CompressedY ||
    senderCommitment !== publicSignals.senderCommitment
  ) {
    console.error("successfully generated proof, but PIs don't match", {
      publicSignalsFromProof: publicSignals,
      publicSignalsExpected: {
        newNoteACommitment: baseJoinSplit.newNoteACommitment,
        newNoteBCommitment: baseJoinSplit.newNoteBCommitment,
        commitmentTreeRoot: baseJoinSplit.commitmentTreeRoot,
        publicSpend: baseJoinSplit.publicSpend,
        nullifierA: baseJoinSplit.nullifierA,
        nullifierB: baseJoinSplit.nullifierB,
        senderCommitment,
        opDigest,
        encododedAssetAddrWithSignBits:
          proofInputs.encodedAssetAddrWithSignBits,
        encodedAssetID: proofInputs.encodedAssetId,
        refundAddrH1CompressedY: refundAddrH1CompressedY,
        refundAddrH2CompressedY: refundAddrH2CompressedY,
      },
    });

    throw new Error(
      `snarkjs generated public input differs from precomputed ones`
    );
  }

  console.log("successfully generated proofs", {
    proofWithPublicSignals: proof,
  });

  const solidityProof = packToSolidityProof(proof.proof);
  return {
    proof: solidityProof,
    senderCommitment,
    ...baseJoinSplit,
  };
}
