/* eslint-disable */

export interface BaseProof {
  pi_a: any;
  pi_b: any;
  pi_c: any;
  protocol: string;
  curve?: any; // TODO: make this not optional
}

export interface MerkleProofInput {
  path: bigint[];
  siblings: any[];
}
