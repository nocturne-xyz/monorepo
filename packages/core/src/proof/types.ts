/* eslint-disable */

export interface BaseProof {
  pi_a: any;
  pi_b: any;
  pi_c: any;
  protocol: string;
  curve?: any; // TODO: make this not optional
}

export type SolidityProof = [
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint
];

export interface MerkleProofInput {
  path: bigint[];
  siblings: bigint[][];
}

export interface VerifyingKey {
  protocol: string;
  curve: string;
  nPublic: number;
  vk_alpha_1: [string, string, string];
  vk_beta_2: [[string, string], [string, string], [string, string]];
  vk_gamma_2: [[string, string], [string, string], [string, string]];
  vk_delta_2: [[string, string], [string, string], [string, string]];
  vk_alphabeta_12: [
    [[string, string], [string, string], [string, string]],
    [[string, string], [string, string], [string, string]]
  ];
  IC: [string, string, string][];
}
