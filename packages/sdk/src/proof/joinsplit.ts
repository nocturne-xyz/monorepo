import { decomposeCompressedPoint } from "../crypto";
import { EncryptedCanonAddress } from "../crypto/address";
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
    bigint, // encSenderCanonAddrC1X
    bigint, // encSenderCanonAddrC2X
    bigint, // operationDigest
    bigint, // encodedAssetAddrWithSignBits
    bigint // encodedAssetId
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
  encodedAssetAddrWithSignBits: bigint;
  encodedAssetId: bigint;
  encSenderCanonAddrC1Y: bigint;
  encSenderCanonAddrC2Y: bigint;
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
  encRandomness: bigint;
  encodedAssetAddrWithSignBits: bigint;
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
    encSenderCanonAddrC1Y: publicSignals[6],
    encSenderCanonAddrC2Y: publicSignals[7],
    opDigest: publicSignals[8],
    encodedAssetAddrWithSignBits: publicSignals[9],
    encodedAssetId: publicSignals[10],
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
  bigint
] {
  return [
    publicSignals.newNoteACommitment,
    publicSignals.newNoteBCommitment,
    publicSignals.commitmentTreeRoot,
    publicSignals.publicSpend,
    publicSignals.nullifierA,
    publicSignals.nullifierB,
    publicSignals.encSenderCanonAddrC1Y,
    publicSignals.encSenderCanonAddrC2Y,
    publicSignals.opDigest,
    publicSignals.encodedAssetAddrWithSignBits,
    publicSignals.encodedAssetId,
  ];
}

// encodedAssetAddr with the sign bits of the encrypted sender canon address placed at bits 248 and 249 (counting from LSB to MSB starting at 0)
export function encodeEncodedAssetAddrWithSignBitsPI(
  encodedAssetAddr: bigint,
  encSenderCanonAddr: EncryptedCanonAddress
): bigint {
  const [sign1] = decomposeCompressedPoint(encSenderCanonAddr.c1);
  const [sign2] = decomposeCompressedPoint(encSenderCanonAddr.c2);
  return encodedAssetAddr | (BigInt(sign1) << 248n) | (BigInt(sign2) << 249n);
}
