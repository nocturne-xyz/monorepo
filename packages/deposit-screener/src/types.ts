import { DepositRequest } from "@nocturne-xyz/sdk";

export enum DepositEventType {
  Instantiated = "Instantiated",
  Retrieved = "Retrieved",
  Processed = "Processed",
}

export interface DepositEvent extends DepositRequest {
  type: DepositEventType;
}
