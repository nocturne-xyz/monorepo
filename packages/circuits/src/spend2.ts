//@ts-ignore
import * as snarkjs from "snarkjs";
import * as path from "path";

const BUILD_DIR = path.join(__dirname, "../../build");
const WASM_PATH = `${BUILD_DIR}/spend2/spend2_js/spend2.wasm`;
const ZKEY_PATH = `${BUILD_DIR}/spend2/spend2_cpp/spend2.zkey`;

export interface ProofWithPublicSignals {
  proof: {
    pi_a: any;
    pi_b: any;
    pi_c: any;
    protocol: string;
    curve: any;
  };
  publicSignals: any;
}

export interface FlaxAddressInput {
  h1X: BigInt;
  h1Y: BigInt;
  h2X: BigInt;
  h2Y: BigInt;
  h3X: BigInt;
  h3Y: BigInt;
}

export interface NoteInput {
  owner: FlaxAddressInput;
  nonce: BigInt;
  type: BigInt;
  value: BigInt;
  id: BigInt;
}

export interface MerkleProofInput {
  path: BigInt[];
  siblings: BigInt[];
}

export interface Spend2Inputs {
  vk: BigInt;
  operationDigest: BigInt;
  c: BigInt;
  z: BigInt;
  oldNote: NoteInput;
  newNote: NoteInput;
  merkleProof: MerkleProofInput;
}

export async function proveSpend2(
  inputs: Spend2Inputs,
  wasmPath = WASM_PATH,
  zkeyPath = ZKEY_PATH
): Promise<ProofWithPublicSignals> {
  const { vk, operationDigest, c, z, oldNote, newNote, merkleProof } = inputs;
  const signals = {
    vk,

    operationDigest,

    c,
    z,

    oldNoteOwnerH1X: oldNote.owner.h1X,
    oldNoteOwnerH1Y: oldNote.owner.h1Y,
    oldNoteOwnerH2X: oldNote.owner.h2X,
    oldNoteOwnerH2Y: oldNote.owner.h2Y,
    oldNoteOwnerH3X: oldNote.owner.h3X,
    oldNoteOwnerH3Y: oldNote.owner.h3Y,
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
    newNoteOwnerH3X: newNote.owner.h3X,
    newNoteOwnerH3Y: newNote.owner.h3Y,
    newNoteNonce: newNote.nonce,
    newNoteType: newNote.type,
    newNoteId: newNote.id,
    newNoteValue: newNote.value,
  };

  return await snarkjs.groth16.fullProve(signals, wasmPath, zkeyPath);
}
