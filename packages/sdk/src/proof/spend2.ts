import findWorkspaceRoot from "find-yarn-workspace-root";

//@ts-ignore
import * as snarkjs from "snarkjs";
import * as path from "path";
import { BaseProof, normalizePublicSignals } from "./common";
import * as fs from "fs";

// eslint-disable-next-line
const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/spend2/spend2_js/spend2.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/spend2/spend2_cpp/spend2.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/spend2/spend2_cpp/vkey.json`;

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

export interface FlaxAddressInput {
  h1X: bigint;
  h1Y: bigint;
  h2X: bigint;
  h2Y: bigint;
}

export interface NoteInput {
  owner: FlaxAddressInput;
  nonce: bigint;
  type: bigint;
  value: bigint;
  id: bigint;
}

export interface MerkleProofInput {
  path: bigint[];
  siblings: bigint[];
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

export async function proveSpend2(
  inputs: Spend2Inputs,
  wasmPath = WASM_PATH,
  zkeyPath = ZKEY_PATH
): Promise<Spend2ProofWithPublicSignals> {
  const { vk, operationDigest, oldNote, spendPk, newNote, merkleProof, c, z } =
    inputs;
  const signals = {
    vk,

    spendPkX: spendPk[0],
    spendPkY: spendPk[1],
    spendPkNonce: BigInt(1),

    operationDigest,

    c,
    z,

    oldNoteOwnerH1X: oldNote.owner.h1X,
    oldNoteOwnerH1Y: oldNote.owner.h1Y,
    oldNoteOwnerH2X: oldNote.owner.h2X,
    oldNoteOwnerH2Y: oldNote.owner.h2Y,
    oldNoteNonce: oldNote.nonce,
    oldNoteType: oldNote.type,
    oldNoteId: oldNote.id,
    oldNoteValue: oldNote.value,

    path: merkleProof.path,
    siblings: merkleProof.siblings,

    newNoteOwnerH1X: newNote.owner.h1X,
    newNoteOwnerH1Y: newNote.owner.h1Y,
    newNoteOwnerH2X: newNote.owner.h2X,
    newNoteOwnerH2Y: newNote.owner.h2Y,
    newNoteNonce: newNote.nonce,
    newNoteType: newNote.type,
    newNoteId: newNote.id,
    newNoteValue: newNote.value,
  };

  const proof = await snarkjs.groth16.fullProve(signals, wasmPath, zkeyPath);
  proof.publicSignals = normalizePublicSignals(proof.publicSignals);
  return proof;
}

export async function verifySpend2Proof(
  { proof, publicSignals }: Spend2ProofWithPublicSignals,
  vkeyPath = VKEY_PATH
): Promise<boolean> {
  const verificationKey = JSON.parse(fs.readFileSync(vkeyPath, "utf-8"));
  return await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
}

export function spend2ProofToJson(proof: Spend2ProofWithPublicSignals): string {
  return JSON.stringify(
    proof,
    (_, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
  );
}
