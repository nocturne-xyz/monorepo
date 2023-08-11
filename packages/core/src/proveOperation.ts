import { decompressPoint } from "./crypto";
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
import { iterChunks } from "./utils";

// SDK will fire off at most this many provers in parallel
const MAX_PARALLEL_PROVERS = 4;

export async function proveOperation(
  prover: JoinSplitProver,
  op: SignedOperation
): Promise<ProvenOperation> {
  const joinSplits: ProvenJoinSplit[] = [];
  for (const batch of iterChunks(op.joinSplits, MAX_PARALLEL_PROVERS)) {
    const provenBatch = await Promise.all(
      batch.map((joinSplit) => proveJoinSplit(prover, joinSplit))
    );
    joinSplits.push(...provenBatch);
  }

  const {
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

async function proveJoinSplit(
  prover: JoinSplitProver,
  signedJoinSplit: PreProofJoinSplit
): Promise<ProvenJoinSplit> {
  const { opDigest, proofInputs, encSenderCanonAddr, ...baseJoinSplit } =
    signedJoinSplit;
  console.log("proving joinSplit", { proofInputs });
  const proof = await prover.proveJoinSplit(proofInputs);

  const decompressedC1 = decompressPoint(encSenderCanonAddr.c1);
  const decompressedC2 = decompressPoint(encSenderCanonAddr.c2);

  // Check that snarkjs output is consistent with our precomputed joinsplit values
  const publicSignals = joinSplitPublicSignalsFromArray(proof.publicSignals);
  if (
    baseJoinSplit.newNoteACommitment !==
      BigInt(publicSignals.newNoteACommitment) ||
    baseJoinSplit.newNoteBCommitment !==
      BigInt(publicSignals.newNoteBCommitment) ||
    baseJoinSplit.commitmentTreeRoot !==
      BigInt(publicSignals.commitmentTreeRoot) ||
    baseJoinSplit.publicSpend !== BigInt(publicSignals.publicSpend) ||
    baseJoinSplit.nullifierA !== BigInt(publicSignals.nullifierA) ||
    baseJoinSplit.nullifierB !== BigInt(publicSignals.nullifierB) ||
    baseJoinSplit.encodedAsset.encodedAssetId !==
      BigInt(publicSignals.encodedAssetId) ||
    opDigest !== BigInt(publicSignals.opDigest) ||
    decompressedC1 === undefined ||
    decompressedC2 === undefined ||
    decompressedC1.y !== BigInt(publicSignals.encSenderCanonAddrC1Y) ||
    decompressedC2.y !== BigInt(publicSignals.encSenderCanonAddrC2Y)
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
        encodedAssetAddr: baseJoinSplit.encodedAsset.encodedAssetAddr,
        encodedAssetId: baseJoinSplit.encodedAsset.encodedAssetId,
        decompressedC1Y: decompressedC1?.y,
        decompressedC2Y: decompressedC2?.y,
        opDigest,
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
    encSenderCanonAddrC1: encSenderCanonAddr.c1,
    encSenderCanonAddrC2: encSenderCanonAddr.c2,
    ...baseJoinSplit,
  };
}
