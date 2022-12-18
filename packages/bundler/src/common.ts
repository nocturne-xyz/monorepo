export const PROVEN_OPERATION_QUEUE = "ProvenOperationQueue";
export const OPERATION_BATCH_QUEUE = "OperationBatchQueue";
export const PROVEN_OPERATION_JOB_TAG = "PROVEN_OPERATION";
export const OPERATION_BATCH_JOB_TAG = "OPERATION_BATCH";

export type ProvenOperationJobData = {
  operationJson: string;
};

export type OperationBatchJobData = {
  operationBatchJson: string;
};

export enum OperationStatus {
  QUEUED = "QUEUED",
  PRE_BATCH = "PRE_BATCH",
  IN_BATCH = "IN_BATCH",
  IN_FLIGHT = "IN_FLIGHT",
  FAILED_TO_EXECUTE = "FAILED_TO_EXECUTE",
  EXECUTED_SUCCESS = "EXECUTED_SUCCESS",
  EXECUTED_FAILED = "EXECUTED_FAILED",
}
