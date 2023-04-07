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
    bigint, // asset
    bigint, // id
    bigint, // valueLeft
    bigint, // nullifierA
    bigint, // nullifierB
    bigint, // operationDigest
    bigint, // encSenderCanonAddrC1X
    bigint, // encSenderCanonAddrC2X 
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
  enSenderCanonAddrC1X: bigint;
  enSenderCanonAddrC2X: bigint;
}

export interface JoinSplitInputs {
  vk: bigint;
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
    opDigest: publicSignals[6],
    encodedAssetAddr: publicSignals[7],
    encodedAssetId: publicSignals[8],
    enSenderCanonAddrC1X: publicSignals[9],
    enSenderCanonAddrC2X: publicSignals[10],
  };
}

export function joinSplitPublicSignalsToArray(
  publicSignals: JoinSplitPublicSignals
): [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] {
  return [
    publicSignals.newNoteACommitment,
    publicSignals.newNoteBCommitment,
    publicSignals.commitmentTreeRoot,
    publicSignals.publicSpend,
    publicSignals.nullifierA,
    publicSignals.nullifierB,
    publicSignals.opDigest,
    publicSignals.encodedAssetAddr,
    publicSignals.encodedAssetId,
    publicSignals.enSenderCanonAddrC1X,
    publicSignals.enSenderCanonAddrC2X,
  ];
}
