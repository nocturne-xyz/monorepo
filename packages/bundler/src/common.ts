export const PROVEN_OPERATIONS_QUEUE = "ProvenOperations";
export const RELAY_JOB_TYPE = "RELAY";

export type RelayJobData = {
  operationJson: string;
};

export enum OperationStatus {
  QUEUED = "QUEUED",
  ACCEPTED = "ACCEPTED",
  IN_FLIGHT = "IN_FLIGHT",
  FAILED_TO_EXECUTE = "FAILED_TO_EXECUTE",
  EXECUTED_SUCCESS = "EXECUTED_SUCCESS",
  EXECUTED_FAILED = "EXECUTED_FAILED",
}
