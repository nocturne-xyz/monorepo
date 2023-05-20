import { OperationStatus, ProvenOperation } from "@nocturne-xyz/sdk";

export type RelayRequest = ProvenOperation;

export interface RelayResponse {
  id: string;
}

export interface OperationStatusResponse {
  status: OperationStatus;
}
