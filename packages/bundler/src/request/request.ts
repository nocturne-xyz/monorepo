import { OperationStatus, ProvenOperation } from "@nocturne-xyz/sdk";

export interface RelayRequest {
  operation: ProvenOperation;
}

export interface RelayResponse {
  id: string;
}

export interface OperationStatusResponse {
  status: OperationStatus;
}
