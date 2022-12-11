export const PROVEN_OPERATIONS_QUEUE = "ProvenOperations";

export type RelayJobData = {
  status: OperationStatus;
  operationJson: string;
};

export enum OperationStatus {
  QUEUED = "QUEUED",
  ACCEPTED = "ACCEPTED",
  IN_FLIGHT = "IN_FLIGHT",
  EXECUTED = "EXECUTED",
  FAILED = "FAILED",
}
