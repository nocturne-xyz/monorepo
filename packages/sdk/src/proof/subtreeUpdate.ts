import { BaseProof } from "./types";

export interface SubtreeUpdateProofWithPublicSignals {
  proof: BaseProof;
  publicSignals: [
    bigint, // oldRoot
    bigint, // newRoot 
    bigint, // encodedPathAndHash
    bigint, // accumulatorHash
  ];
}

export interface SubtreeUpdateInputSignals {
  encodedPathAndHash: bigint;
  accumulatorHash: bigint;

  siblings: bigint[];
  leaves: bigint[];
  bitmap: bigint[];
  ownerH1s: bigint[];
  ownerH2s: bigint[];
  nonces: bigint[];
  assets: bigint[];
  ids: bigint[];
  values: bigint[];
}

export interface SubtreeUpdateProver {
  prove(
    inputs: SubtreeUpdateInputSignals,
    wasmPath?: string,
    zkeyPath?: string
  ): Promise<SubtreeUpdateProofWithPublicSignals>;

  verify(
    { proof, publicSignals }: SubtreeUpdateProofWithPublicSignals,
    vkey: any
  ): Promise<boolean>;
}
