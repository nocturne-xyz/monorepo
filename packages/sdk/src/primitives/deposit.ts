import { StealthAddress } from "../crypto";
import { EncodedAsset } from "./asset";

export interface DepositRequest {
  spender: string;
  encodedAsset: EncodedAsset;
  value: bigint;
  depositAddr: StealthAddress;
  nonce: bigint;
  gasCompensation: bigint;
}

export enum DepositRequestStatus {
  DoesNotExist = "DoesNotExist",
  FailedScreen = "FailedScreen",
  PassedFirstScreen = "PassedFirstScreen",
  AwaitingFulfillment = "AwaitingFulfillment",
  Completed = "Completed",
}
