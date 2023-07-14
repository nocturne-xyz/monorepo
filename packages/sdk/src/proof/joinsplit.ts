import { decomposeCompressedPoint } from "../crypto";
import { CompressedStealthAddress } from "../crypto/address";
import { EncodedNote } from "../primitives";
import { BaseProof, MerkleProofInput } from "./types";

export interface JoinSplitProver {
  proveJoinSplit(
    inputs: JoinSplitInputs
  ): Promise<JoinSplitProofWithPublicSignals>;

  verifyJoinSplitProof({
    proof,
    publicSignals,
  }: JoinSplitProofWithPublicSignals): Promise<boolean>;
}

export interface JoinSplitProofWithPublicSignals {
  proof: BaseProof;
  publicSignals: [
    bigint, // newNoteACommitment
    bigint, // newNoteBCommitment
    bigint, // anchor
    bigint, // publicSpend
    bigint, // nullifierA
    bigint, // nullifierB
    bigint, // ssenderCommitment
    bigint, // operationDigest
    bigint, // pubEncodedAssetAddrWithSignBits
    bigint, // pubEncodedAssetId
    bigint, // refundAddrH1CompressedY
    bigint // refundAddrH2CompressedY
  ];
}

export interface JoinSplitPublicSignals {
  newNoteACommitment: bigint;
  newNoteBCommitment: bigint;
  commitmentTreeRoot: bigint;
  publicSpend: bigint;
  nullifierA: bigint;
  nullifierB: bigint;
  opDigest: bigint;
  pubEncodedAssetAddrWithSignBits: bigint;
  pubEncodedAssetId: bigint;
  refundAddrH1CompressedY: bigint;
  refundAddrH2CompressedY: bigint;
  senderCommitment: bigint;
}

export interface JoinSplitInputs {
  vk: bigint;
  vkNonce: bigint;
  spendPk: [bigint, bigint];
  operationDigest: bigint;
  c: bigint;
  z: bigint;
  oldNoteA: EncodedNote;
  oldNoteB: EncodedNote;
  merkleProofA: MerkleProofInput;
  merkleProofB: MerkleProofInput;
  newNoteA: EncodedNote;
  newNoteB: EncodedNote;
  refundAddr: CompressedStealthAddress;
  pubEncodedAssetAddrWithSignBits: bigint;
  pubEncodedAssetId: bigint;
}

export function joinSplitPublicSignalsFromArray(
  publicSignals: bigint[]
): JoinSplitPublicSignals {
  return {
    newNoteACommitment: publicSignals[0],
    newNoteBCommitment: publicSignals[1],
    commitmentTreeRoot: publicSignals[2],
    publicSpend: publicSignals[3],
    nullifierA: publicSignals[4],
    nullifierB: publicSignals[5],
    senderCommitment: publicSignals[6],
    opDigest: publicSignals[7],
    pubEncodedAssetAddrWithSignBits: publicSignals[8],
    pubEncodedAssetId: publicSignals[9],
    refundAddrH1CompressedY: publicSignals[10],
    refundAddrH2CompressedY: publicSignals[11],
  };
}

export function joinSplitPublicSignalsToArray(
  publicSignals: JoinSplitPublicSignals
): [
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint
] {
  return [
    publicSignals.newNoteACommitment,
    publicSignals.newNoteBCommitment,
    publicSignals.commitmentTreeRoot,
    publicSignals.publicSpend,
    publicSignals.nullifierA,
    publicSignals.nullifierB,
    publicSignals.senderCommitment,
    publicSignals.opDigest,
    publicSignals.pubEncodedAssetAddrWithSignBits,
    publicSignals.pubEncodedAssetId,
    publicSignals.refundAddrH1CompressedY,
    publicSignals.refundAddrH2CompressedY,
  ];
}

// encodedAssetAddr with the sign bits of the encrypted sender canon address placed at bits 248 and 249 (counting from LSB to MSB starting at 0)
export function encodeEncodedAssetAddrWithSignBitsPI(
  encodedAssetAddr: bigint,
  refundAddr: CompressedStealthAddress
): bigint {
  const [sign1] = decomposeCompressedPoint(refundAddr.h1);
  const [sign2] = decomposeCompressedPoint(refundAddr.h2);
  return encodedAssetAddr | (BigInt(sign1) << 248n) | (BigInt(sign2) << 249n);
}
