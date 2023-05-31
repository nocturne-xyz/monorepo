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
    bigint, // hodgePodge
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
  hodgePodge: bigint;
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
  hodgePodge: bigint;
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
    hodgePodge: publicSignals[9],
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
    publicSignals.hodgePodge,
    publicSignals.encodedAssetId,
  ];
}

const SIGN_BIT_MASK = 1n << 254n;

// encodedAssetAddr with the sign bits of the encrypted sender canon address placed at bits 248 and 249 (counting from LSB to MSB starting at 0)
export function encodeHodgePodgePI(
  encodedAssetAddr: bigint,
  encSenderCanonAddr: EncryptedCanonAddress
): bigint {
  const signBit0Mask = encSenderCanonAddr.c1 & SIGN_BIT_MASK;
  const signBit1Mask = encSenderCanonAddr.c2 & SIGN_BIT_MASK;

  return encodedAssetAddr | (signBit0Mask >> 6n) | (signBit1Mask >> 5n);
}
