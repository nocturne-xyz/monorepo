export const PROVEN_OPERATIONS_QUEUE = "ProvenOperations";
export const RELAY_JOB_TYPE = "RELAY";

export type RelayJobData = {
  operationJson: string;
};

export enum OperationStatus {
  QUEUED = "QUEUED",
  ACCEPTED = "ACCEPTED",
  IN_FLIGHT = "IN_FLIGHT",
  EXECUTED = "EXECUTED",
  FAILED = "FAILED",
}
