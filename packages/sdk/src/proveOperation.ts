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
    refundAddr,
    encodedRefundAssets,
    actions,
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
    chainId: 0n,
    deadline: 1000n,
  };
}

async function proveJoinSplit(
  prover: JoinSplitProver,
  signedJoinSplit: PreProofJoinSplit
): Promise<ProvenJoinSplit> {
  const { opDigest, proofInputs, ...baseJoinSplit } = signedJoinSplit;
  const proof = await prover.proveJoinSplit(proofInputs);

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
    baseJoinSplit.encodedAsset.encodedAssetAddr !==
      BigInt(publicSignals.encodedAssetAddr) ||
    baseJoinSplit.encodedAsset.encodedAssetId !==
      BigInt(publicSignals.encodedAssetId) ||
    opDigest !== BigInt(publicSignals.opDigest)
  ) {
    console.error("from proof, got", publicSignals);
    console.error("from sdk, got", {
      newNoteACommitment: baseJoinSplit.newNoteACommitment,
      newNoteBCommitment: baseJoinSplit.newNoteBCommitment,
      commitmentTreeRoot: baseJoinSplit.commitmentTreeRoot,
      publicSpend: baseJoinSplit.publicSpend,
      nullifierA: baseJoinSplit.nullifierA,
      nullifierB: baseJoinSplit.nullifierB,
      encodedAssetAddr: baseJoinSplit.encodedAsset.encodedAssetAddr,
      encodedAssetId: baseJoinSplit.encodedAsset.encodedAssetId,
      opDigest,
    });

    throw new Error(
      `SnarkJS generated public input differs from precomputed ones`
    );
  }

  console.log("proofWithPis", proof);

  const solidityProof = packToSolidityProof(proof.proof);
  return {
    proof: solidityProof,
    ...baseJoinSplit,
  };
}
