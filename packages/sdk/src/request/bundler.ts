import {
  OperationStatus,
  OnchainOperationWithNetworkInfo,
} from "../primitives";

export interface RelayRequest {
  operation: OnchainOperationWithNetworkInfo;
}

export interface RelayResponse {
  id: string;
}

export interface OperationStatusResponse {
  status: OperationStatus;
}
