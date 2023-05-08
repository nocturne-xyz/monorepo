import { BaseProof, SubtreeUpdateInputs } from "@nocturne-xyz/sdk";

export interface ProofJobData {
  subtreeIndex: number;
  newRoot: bigint;
  proofInputs: SubtreeUpdateInputs;
}

export interface SubmissionJobData {
  proof: BaseProof;
  newRoot: bigint;
}
