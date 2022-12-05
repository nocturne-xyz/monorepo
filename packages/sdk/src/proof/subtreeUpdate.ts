import { BaseProof } from "./types";

export interface SubtreeUpdateProofWithPublicSignals {
  proof: BaseProof;
  publicSignals: [
    bigint, // oldRoot
    bigint, // newRoot
    bigint, // encodedPathAndHash
    bigint // accumulatorHash
  ];
}

export interface SubtreeUpdateInputs {
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
  proveSubtreeUpdate(
    inputs: SubtreeUpdateInputs
  ): Promise<SubtreeUpdateProofWithPublicSignals>;

  verifySubtreeUpdate({
    proof,
    publicSignals,
  }: SubtreeUpdateProofWithPublicSignals): Promise<boolean>;
}
