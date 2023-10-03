import {
  ClosableAsyncIterator,
  IterSyncOpts,
  TotalEntityIndex,
  DepositRequest,
} from "@nocturne-xyz/core";

export enum DepositEventType {
  Instantiated = "Instantiated",
  Retrieved = "Retrieved",
  Processed = "Processed",
}
export interface DepositEvent extends DepositRequest {
  type: DepositEventType;
}

export interface DepositEventsBatch {
  totalEntityIndex: TotalEntityIndex;
  depositEvents: DepositEvent[];
}

export interface ScreenerSyncAdapter {
  iterDepositEvents(
    type: DepositEventType,
    startTotalEntityIndex: TotalEntityIndex,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<DepositEventsBatch>;
}
