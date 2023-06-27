import { BaseProof, SubtreeUpdateInputs } from "@nocturne-xyz/sdk";

export interface ProofJobData {
  subtreeIndex: number;
  newRoot: bigint;
  proofInputs: SubtreeUpdateInputs;
}

export interface SubmissionJobData {
  subtreeIndex: number;
  proof: BaseProof;
  newRoot: bigint;
}

export type SerializedProofJobData = string;
export type SerializedSubmissionJobData = string;
