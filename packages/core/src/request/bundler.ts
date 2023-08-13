import {
  OperationStatus,
  SubmittableOperationWithNetworkInfo,
} from "../primitives";

export interface RelayRequest {
  operation: SubmittableOperationWithNetworkInfo;
}

export interface RelayResponse {
  id: string;
}

export interface OperationStatusResponse {
  status: OperationStatus;
}
