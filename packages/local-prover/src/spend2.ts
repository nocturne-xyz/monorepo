// TODO: make proving work again
import findWorkspaceRoot from "find-yarn-workspace-root";

//@ts-ignore
import * as snarkjs from "snarkjs";
import * as path from "path";
import * as fs from "fs";
import { normalizePublicSignals, normalizeBigInt } from "./utils";
import {
  FlaxAddressStruct,
  MerkleProofInput,
  NoteInput,
  Spend2Inputs,
  Spend2ProofWithPublicSignals,
  Spend2Prover,
} from "@flax/sdk";

// eslint-disable-next-line
const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/spend2/spend2_js/spend2.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/spend2/spend2_cpp/spend2.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/spend2/spend2_cpp/vkey.json`;

export class LocalSpend2Prover implements Spend2Prover {
  // TODO: should prover hold the artifacts?
  async proveSpend2(
    inputs: Spend2Inputs,
    wasmPath = WASM_PATH,
    zkeyPath = ZKEY_PATH
  ): Promise<Spend2ProofWithPublicSignals> {
    inputs = normalizeSpend2Inputs(inputs);
    const {
      vk,
      operationDigest,
      oldNote,
      spendPk,
      newNote,
      merkleProof,
      c,
      z,
    } = inputs;
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
      oldNoteAsset: oldNote.asset,
      oldNoteId: oldNote.id,
      oldNoteValue: oldNote.value,

      path: merkleProof.path,
      siblings: merkleProof.siblings,

      newNoteOwnerH1X: newNote.owner.h1X,
      newNoteOwnerH1Y: newNote.owner.h1Y,
      newNoteOwnerH2X: newNote.owner.h2X,
      newNoteOwnerH2Y: newNote.owner.h2Y,
      newNoteNonce: newNote.nonce,
      newNoteAsset: newNote.asset,
      newNoteId: newNote.id,
      newNoteValue: newNote.value,
    };

    const proof = await snarkjs.groth16.fullProve(signals, wasmPath, zkeyPath);
    proof.publicSignals = normalizePublicSignals(proof.publicSignals);
    return proof;
  }

  async verifySpend2Proof(
    { proof, publicSignals }: Spend2ProofWithPublicSignals,
    vkeyPath = VKEY_PATH
  ): Promise<boolean> {
    const verificationKey = JSON.parse(fs.readFileSync(vkeyPath, "utf-8"));
    return await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
  }
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
