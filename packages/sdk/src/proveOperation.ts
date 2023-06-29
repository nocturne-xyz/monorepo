import { Logger } from "winston";
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

export async function proveOperation(
  prover: JoinSplitProver,
  op: SignedOperation,
  logger?: Logger
): Promise<ProvenOperation> {
  const joinSplits: ProvenJoinSplit[] = await Promise.all(
    op.joinSplits.map((joinSplit) => proveJoinSplit(prover, joinSplit, logger))
  );

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
  signedJoinSplit: PreProofJoinSplit,
  logger?: Logger
): Promise<ProvenJoinSplit> {
  const {
    opDigest,
    proofInputs,
    refundAddr,
    senderCommitment,
    ...baseJoinSplit
  } = signedJoinSplit;
  logger && logger.debug("proving joinSplit", { proofInputs });
  const proof = await prover.proveJoinSplit(proofInputs);

  const decompressedRefundAddrH1 = decompressPoint(refundAddr.h1);
  const decompressedRefundAddrH2 = decompressPoint(refundAddr.h2);

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
    opDigest !== BigInt(publicSignals.opDigest) ||
    decompressedRefundAddrH1 === undefined ||
    decompressedRefundAddrH2 === undefined ||
    decompressedRefundAddrH1.y !==
      BigInt(publicSignals.refundAddrH1CompressedY) ||
    decompressedRefundAddrH2.y !==
      BigInt(publicSignals.refundAddrH2CompressedY) ||
    publicSignals.senderCommitment !== BigInt(senderCommitment)
  ) {
    logger &&
      logger.error("successfully generated proof, but PIs don't match", {
        publicSignalsFromProof: publicSignals,
        publicSignalsExpected: {
          newNoteACommitment: baseJoinSplit.newNoteACommitment,
          newNoteBCommitment: baseJoinSplit.newNoteBCommitment,
          commitmentTreeRoot: baseJoinSplit.commitmentTreeRoot,
          publicSpend: baseJoinSplit.publicSpend,
          nullifierA: baseJoinSplit.nullifierA,
          nullifierB: baseJoinSplit.nullifierB,
          decompressedRefundAddrH1Y: decompressedRefundAddrH1?.y,
          decompressedRefundAddrH2Y: decompressedRefundAddrH2?.y,
          senderCommitment,
          opDigest,
        },
      });

    throw new Error(
      `snarkjs generated public input differs from precomputed ones`
    );
  }

  logger &&
    logger.debug("successfully generated proofs", {
      proofWithPublicSignals: proof,
    });

  const solidityProof = packToSolidityProof(proof.proof);
  return {
    proof: solidityProof,
    senderCommitment,
    ...baseJoinSplit,
  };
}
