import { normalizeBigInt } from "./utils";
import { FlaxAddressStruct } from "../crypto/address";
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
  newNoteCommitmentA: bigint;
  newNoteCommitmentB: bigint;
  anchor: bigint;
  asset: bigint;
  id: bigint;
  valueToSpend: bigint;
  nullifierA: bigint;
  nullifierB: bigint;
  operationDigest: bigint;
}

export interface JoinSplitInputs {
  vk: bigint;
  operationDigest: bigint;
  oldNoteA: NoteInput;
  oldNoteB: NoteInput;
  spendPk: [bigint, bigint];
  newNoteA: NoteInput;
  newNoteB: NoteInput;
  merkleProofA: MerkleProofInput;
  merkleProofB: MerkleProofInput;
  c: bigint;
  z: bigint;
}

export function joinsplitPublicSignalsArrayToTyped(
  publicSignals: bigint[]
): JoinSplitPublicSignals {
  return {
    newNoteCommitmentA: publicSignals[0],
    newNoteCommitmentB: publicSignals[1],
    anchor: publicSignals[2],
    asset: publicSignals[3],
    id: publicSignals[4],
    valueToSpend: publicSignals[5],
    nullifierA: publicSignals[6],
    nullifierB: publicSignals[7],
    operationDigest: publicSignals[8],
  };
}

function normalizeFlaxAddressInput(
  flaxAddressInput: FlaxAddressStruct
): FlaxAddressStruct {
  const { h1X, h1Y, h2X, h2Y } = flaxAddressInput;
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
    owner: normalizeFlaxAddressInput(owner),
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
