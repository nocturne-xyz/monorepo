import { OperationStatus, ProvenOperation } from "../primitives";

export interface RelayRequest {
  operation: ProvenOperation;
}

export interface RelayResponse {
  id: string;
}

export interface OperationStatusResponse {
  status: OperationStatus;
}
