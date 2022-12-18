/* eslint-disable */

export interface BaseProof {
  pi_a: any;
  pi_b: any;
  pi_c: any;
  protocol: string;
  curve?: any;
}

export interface MerkleProofInput {
  path: bigint[];
  siblings: any[];
}
