/* eslint-disable */

import { FlaxAddressStruct } from "../crypto";

export interface BaseProof {
  pi_a: any;
  pi_b: any;
  pi_c: any;
  protocol: string;
  curve: any;
}

export interface MerkleProofInput {
  path: bigint[];
  siblings: any[];
}

export interface NoteInput {
  owner: FlaxAddressStruct;
  nonce: bigint;
  asset: bigint;
  value: bigint;
  id: bigint;
}
