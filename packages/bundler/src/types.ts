export const ACTOR_NAME = "bundler";

export const SUBMITTABLE_OPERATION_QUEUE = "SubmittableOperationQueue";
export const OPERATION_BATCH_QUEUE = "OperationBatchQueue";
export const PROVEN_OPERATION_JOB_TAG = "PROVEN_OPERATION";
export const OPERATION_BATCH_JOB_TAG = "OPERATION_BATCH";

export type OperationJobData = {
  operationJson: string;
};

export type OperationBatchJobData = {
  operationBatchJson: string;
};

export enum OpValidationFailure {
  NotEnoughGas = "NotEnoughGas",
  NullifierConflict = "NullifierConflict",
  CallRevert = "CallRevert",
}
