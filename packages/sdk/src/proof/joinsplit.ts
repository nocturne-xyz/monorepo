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
    bigint, // encodedAssetAddr
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
  encodedAssetAddr: bigint;
  encodedAssetId: bigint;
  encSenderCanonAddrC1X: bigint;
  encSenderCanonAddrC2X: bigint;
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
    encSenderCanonAddrC1X: publicSignals[6],
    encSenderCanonAddrC2X: publicSignals[7],
    opDigest: publicSignals[8],
    encodedAssetAddr: publicSignals[9],
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
    publicSignals.encSenderCanonAddrC1X,
    publicSignals.encSenderCanonAddrC2X,
    publicSignals.opDigest,
    publicSignals.encodedAssetAddr,
    publicSignals.encodedAssetId,
  ];
}
