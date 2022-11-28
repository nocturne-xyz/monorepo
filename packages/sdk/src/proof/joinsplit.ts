import findWorkspaceRoot from "find-yarn-workspace-root";

//@ts-ignore
import * as snarkjs from "snarkjs";
import * as path from "path";
import * as fs from "fs";
import { normalizePublicSignals, normalizeBigInt } from "./utils";
import { FlaxAddressStruct } from "../crypto/address";
import { BaseProof } from "./types";

// eslint-disable-next-line
const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_js/joinsplit.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/joinsplit.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/vkey.json`;

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

export function publicSignalsArrayToTyped(
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

export async function proveJoinSplit(
  inputs: JoinSplitInputs,
  wasmPath = WASM_PATH,
  zkeyPath = ZKEY_PATH
): Promise<JoinSplitProofWithPublicSignals> {
  inputs = normalizeJoinSplitInputs(inputs);
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
  const signals = {
    userViewKey: vk,

    spendPubKey: spendPk,
    userViewKeyNonce: BigInt(1),

    operationDigest,

    c,
    z,

    oldNoteAOwnerH1X: oldNoteA.owner.h1X,
    oldNoteAOwnerH1Y: oldNoteA.owner.h1Y,
    oldNoteAOwnerH2X: oldNoteA.owner.h2X,
    oldNoteAOwnerH2Y: oldNoteA.owner.h2Y,
    oldNoteANonce: oldNoteA.nonce,
    oldNoteAEncodedAsset: oldNoteA.asset,
    oldNoteAEncodedId: oldNoteA.id,
    oldNoteAValue: oldNoteA.value,

    pathA: merkleProofA.path,
    siblingsA: merkleProofA.siblings,

    oldNoteBOwnerH1X: oldNoteB.owner.h1X,
    oldNoteBOwnerH1Y: oldNoteB.owner.h1Y,
    oldNoteBOwnerH2X: oldNoteB.owner.h2X,
    oldNoteBOwnerH2Y: oldNoteB.owner.h2Y,
    oldNoteBNonce: oldNoteB.nonce,
    oldNoteBEncodedAsset: oldNoteB.asset,
    oldNoteBEncodedId: oldNoteB.id,
    oldNoteBValue: oldNoteB.value,

    pathB: merkleProofB.path,
    siblingsB: merkleProofB.siblings,

    newNoteAOwnerH1X: newNoteA.owner.h1X,
    newNoteAOwnerH1Y: newNoteA.owner.h1Y,
    newNoteAOwnerH2X: newNoteA.owner.h2X,
    newNoteAOwnerH2Y: newNoteA.owner.h2Y,
    newNoteANonce: newNoteA.nonce,
    newNoteAEncodedAsset: newNoteA.asset,
    newNoteAEncodedId: newNoteA.id,
    newNoteAValue: newNoteA.value,

    newNoteBOwnerH1X: newNoteB.owner.h1X,
    newNoteBOwnerH1Y: newNoteB.owner.h1Y,
    newNoteBOwnerH2X: newNoteB.owner.h2X,
    newNoteBOwnerH2Y: newNoteB.owner.h2Y,
    newNoteBNonce: newNoteB.nonce,
    newNoteBEncodedAsset: newNoteB.asset,
    newNoteBEncodedId: newNoteB.id,
    newNoteBValue: newNoteB.value,
  };

  const proof = await snarkjs.groth16.fullProve(signals, wasmPath, zkeyPath);
  proof.publicSignals = normalizePublicSignals(proof.publicSignals);
  return proof;
}

export async function verifyJoinSplitProof(
  { proof, publicSignals }: JoinSplitProofWithPublicSignals,
  vkeyPath = VKEY_PATH
): Promise<boolean> {
  const verificationKey = JSON.parse(fs.readFileSync(vkeyPath, "utf-8"));
  return await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
}
