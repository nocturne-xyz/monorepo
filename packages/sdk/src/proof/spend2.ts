import { FlaxAddressStruct } from "../crypto";
import { BaseProof } from "./types";

export interface Spend2Prover {
  proveSpend2(
    inputs: Spend2Inputs,
    wasmPath?: string,
    zkeyPath?: string
  ): Promise<Spend2ProofWithPublicSignals>;

  verifySpend2Proof(
    { proof, publicSignals }: Spend2ProofWithPublicSignals,
    vkeyPath?: string
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
