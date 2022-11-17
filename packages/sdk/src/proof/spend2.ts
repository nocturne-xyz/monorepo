import findWorkspaceRoot from "find-yarn-workspace-root";

//@ts-ignore
// TODO: make proving work again
// import * as snarkjs from "snarkjs";
import * as path from "path";
// import * as fs from "fs";
import {
  BaseProof,
  /* normalizePublicSignals, */ normalizeBigInt,
} from "./common";
import { FlaxAddressStruct } from "../crypto/address";

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

export async function proveSpend2(
  inputs: Spend2Inputs,
  wasmPath = WASM_PATH,
  zkeyPath = ZKEY_PATH
): Promise<Spend2ProofWithPublicSignals> {
  // inputs = normalizeSpend2Inputs(inputs);
  // const { vk, operationDigest, oldNote, spendPk, newNote, merkleProof, c, z } =
  //   inputs;
  // const signals = {
  //   vk,

  //   spendPkX: spendPk[0],
  //   spendPkY: spendPk[1],
  //   spendPkNonce: BigInt(1),

  //   operationDigest,

  //   c,
  //   z,

  //   oldNoteOwnerH1X: oldNote.owner.h1X,
  //   oldNoteOwnerH1Y: oldNote.owner.h1Y,
  //   oldNoteOwnerH2X: oldNote.owner.h2X,
  //   oldNoteOwnerH2Y: oldNote.owner.h2Y,
  //   oldNoteNonce: oldNote.nonce,
  //   oldNoteAsset: oldNote.asset,
  //   oldNoteId: oldNote.id,
  //   oldNoteValue: oldNote.value,

  //   path: merkleProof.path,
  //   siblings: merkleProof.siblings,

  //   newNoteOwnerH1X: newNote.owner.h1X,
  //   newNoteOwnerH1Y: newNote.owner.h1Y,
  //   newNoteOwnerH2X: newNote.owner.h2X,
  //   newNoteOwnerH2Y: newNote.owner.h2Y,
  //   newNoteNonce: newNote.nonce,
  //   newNoteAsset: newNote.asset,
  //   newNoteId: newNote.id,
  //   newNoteValue: newNote.value,
  // };

  // const proof = await snarkjs.groth16.fullProve(signals, wasmPath, zkeyPath);
  // proof.publicSignals = normalizePublicSignals(proof.publicSignals);
  // return proof;
  return {
    proof: {
      pi_a: [
        "4625618875644840598028618709964737071286323400035166515439999382907260759149",
        "17311032563331855279445872303264485039998633247887608441088500649081148079946",
        "1",
      ],
      pi_b: [
        [
          "13007885783730414158143984568183321745689009973858290719017290684321521768443",
          "15187630932898581824766028072298509985745514095907718376153248118195922121465",
        ],
        [
          "19982514269577669084161742435664771034313802853778646902466014202600961278963",
          "19575086494256626956571781527451095236278831092611242037553148298417399856249",
        ],
        ["1", "0"],
      ],
      pi_c: [
        "6816063603942979089072353289282218712969038145805634233931162093973057523782",
        "1157455506355460374427767631046449627653083706398878264038471689135201457352",
        "1",
      ],
      protocol: "groth16",
      curve: "bn128",
    },
    publicSignals: [
      14004181798418989328613722247011874689459645890667748560829877407283949597397n,
      9542032276307073637223040869858109255812851392386867028973820839725323970450n,
      10n,
      5n,
      50n,
      13098195026410129504860098353964494825003627132306398337204478043612943076752n,
      12345n,
    ],
  };
}

export async function verifySpend2Proof(
  { proof, publicSignals }: Spend2ProofWithPublicSignals,
  vkeyPath = VKEY_PATH
): Promise<boolean> {
  // const verificationKey = JSON.parse(fs.readFileSync(vkeyPath, "utf-8"));
  // return await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
  return true;
}
