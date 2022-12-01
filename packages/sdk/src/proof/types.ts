/* eslint-disable */

import { NocturneAddress } from "../crypto";

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
  owner: NocturneAddress;
  nonce: bigint;
  asset: bigint;
  value: bigint;
  id: bigint;
}
