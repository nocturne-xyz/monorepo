import { BaseProof, MerkleProofInput, NoteInput } from "./types";

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
    bigint // operationDigest
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
  asset: bigint;
  id: bigint;
}

export interface JoinSplitInputs {
  vk: bigint;
  spendPk: [bigint, bigint];
  operationDigest: bigint;
  c: bigint;
  z: bigint;
  oldNoteA: NoteInput;
  oldNoteB: NoteInput;
  merkleProofA: MerkleProofInput;
  merkleProofB: MerkleProofInput;
  newNoteA: NoteInput;
  newNoteB: NoteInput;
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
    asset: publicSignals[7],
    id: publicSignals[8],
  };
}
