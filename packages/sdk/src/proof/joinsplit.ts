import { normalizeBigInt } from "./utils";
import { NocturneAddress } from "../crypto/address";
import { BaseProof, MerkleProofInput, NoteInput } from "./types";

export interface JoinSplitProver {
  proveJoinSplit(
    inputs: JoinSplitInputs,
    wasmPath: string,
    zkeyPath: string
  ): Promise<JoinSplitProofWithPublicSignals>;

  verifyJoinSplitProof(
    { proof, publicSignals }: JoinSplitProofWithPublicSignals,
    vkey: any
  ): Promise<boolean>;
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

function normalizeNocturneAddressInput(
  nocturneAddressInput: NocturneAddress
): NocturneAddress {
  const { h1X, h1Y, h2X, h2Y } = nocturneAddressInput;
  return {
    h1X: normalizeBigInt(h1X),
    h1Y: normalizeBigInt(h1Y),
    h2X: normalizeBigInt(h2X),
    h2Y: normalizeBigInt(h2Y),
  };
}

function normalizeNoteInput(noteInput: NoteInput): NoteInput {
  const { owner, nonce, asset, value, id } = noteInput;
  return {
    owner: normalizeNocturneAddressInput(owner),
    nonce: normalizeBigInt(nonce),
    asset: normalizeBigInt(asset),
    value: normalizeBigInt(value),
    id: normalizeBigInt(id),
  };
}

function normalizeMerkleProofInput(
  merkleProofInput: MerkleProofInput
): MerkleProofInput {
  const { path, siblings } = merkleProofInput;
  for (let i = 0; i < path.length; i++) {
    path[i] = normalizeBigInt(path[i]);
  }
  for (let i = 0; i < siblings.length; i++) {
    siblings[i] = normalizeBigInt(siblings[i]);
  }

  return { path, siblings };
}

export function normalizeJoinSplitInputs(
  inputs: JoinSplitInputs
): JoinSplitInputs {
  const {
    vk,
    operationDigest,
    oldNoteA,
    oldNoteB,
    spendPk,
    newNoteA,
    newNoteB,
    merkleProofA,
    merkleProofB,
    c,
    z,
  } = inputs;
  const [spendPkX, spendPkY] = spendPk;

  return {
    vk: normalizeBigInt(vk),
    operationDigest: normalizeBigInt(operationDigest),
    oldNoteA: normalizeNoteInput(oldNoteA),
    oldNoteB: normalizeNoteInput(oldNoteB),
    spendPk: [normalizeBigInt(spendPkX), normalizeBigInt(spendPkY)],
    newNoteA: normalizeNoteInput(newNoteA),
    newNoteB: normalizeNoteInput(newNoteB),
    merkleProofA: normalizeMerkleProofInput(merkleProofA),
    merkleProofB: normalizeMerkleProofInput(merkleProofB),
    c: normalizeBigInt(c),
    z: normalizeBigInt(z),
  };
}
