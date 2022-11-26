import { FlaxAddressStruct } from "../crypto";
import { BaseProof } from "./types";
import { normalizeBigInt } from "./utils";

export interface Spend2Prover {
  proveSpend2(
    inputs: Spend2Inputs,
    wasmPath: string,
    zkeyPath: string
  ): Promise<Spend2ProofWithPublicSignals>;

  verifySpend2Proof(
    { proof, publicSignals }: Spend2ProofWithPublicSignals,
    vkey: any
  ): Promise<boolean>;
}

export interface Spend2ProofWithPublicSignals {
  proof: BaseProof;
  publicSignals: [
    bigint, // newNoteCommitment
    bigint, // anchor
    bigint, // type
    bigint, // id
    bigint, // value
    bigint, // nullifier
    bigint // operationDigest
  ];
}

export interface Spend2PublicSignals {
  newNoteCommitment: bigint;
  anchor: bigint;
  asset: bigint;
  id: bigint;
  valueToSpend: bigint;
  nullifier: bigint;
  operationDigest: bigint;
}

export interface NoteInput {
  owner: FlaxAddressStruct;
  nonce: bigint;
  asset: bigint;
  value: bigint;
  id: bigint;
}

export interface MerkleProofInput {
  path: bigint[];
  siblings: any[];
}

export interface Spend2Inputs {
  vk: bigint;
  operationDigest: bigint;
  oldNote: NoteInput;
  spendPk: [bigint, bigint];
  newNote: NoteInput;
  merkleProof: MerkleProofInput;
  c: bigint;
  z: bigint;
}

export function publicSignalsArrayToTyped(
  publicSignals: bigint[]
): Spend2PublicSignals {
  return {
    newNoteCommitment: publicSignals[0],
    anchor: publicSignals[1],
    asset: publicSignals[2],
    id: publicSignals[3],
    valueToSpend: publicSignals[4],
    nullifier: publicSignals[5],
    operationDigest: publicSignals[6],
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

export function normalizeSpend2Inputs(inputs: Spend2Inputs): Spend2Inputs {
  const { vk, operationDigest, oldNote, spendPk, newNote, merkleProof, c, z } =
    inputs;
  const [spendPkX, spendPkY] = spendPk;

  return {
    vk: normalizeBigInt(vk),
    operationDigest: normalizeBigInt(operationDigest),
    oldNote: normalizeNoteInput(oldNote),
    spendPk: [normalizeBigInt(spendPkX), normalizeBigInt(spendPkY)],
    newNote: normalizeNoteInput(newNote),
    merkleProof: normalizeMerkleProofInput(merkleProof),
    c: normalizeBigInt(c),
    z: normalizeBigInt(z),
  };
}
