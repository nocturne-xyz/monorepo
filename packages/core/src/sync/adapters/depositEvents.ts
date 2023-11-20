import { DepositRequest } from "../../primitives";
import { ClosableAsyncIterator } from "../closableAsyncIterator";
import { TotalEntityIndex } from "../totalEntityIndex";
import { IterSyncOpts } from "./shared";

export type OnchainDepositType = "Instantiated" | "Retrieved" | "Completed";

export enum DepositEventType {
  Instantiated = "Instantiated",
  Retrieved = "Retrieved",
  Processed = "Processed",
}

export interface DepositEvent extends DepositRequest {
  type: DepositEventType;
  txHash: string;
  timestamp: bigint;
}

export interface DepositEventsBatch {
  totalEntityIndex: TotalEntityIndex;
  depositEvents: DepositEvent[];
}

export interface DepositEventSyncAdapter {
  iterDepositEvents(
    type: OnchainDepositType,
    startTotalEntityIndex: TotalEntityIndex,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<DepositEventsBatch>;
}
