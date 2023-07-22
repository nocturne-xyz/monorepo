import {
  OperationStatus,
  SignableOperationWithNetworkInfo,
} from "../primitives";

export interface RelayRequest {
  operation: SignableOperationWithNetworkInfo;
}

export interface RelayResponse {
  id: string;
}

export interface OperationStatusResponse {
  status: OperationStatus;
}
