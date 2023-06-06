import {
  ClosableAsyncIterator,
  IterSyncOpts,
  DepositEventType,
  DepositEvent,
} from "@nocturne-xyz/sdk";

export interface DepositEventsBatch {
  blockNumber: number;
  depositEvents: DepositEvent[];
}

export interface ScreenerSyncAdapter {
  iterDepositEvents(
    type: DepositEventType,
    startBlock: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<DepositEventsBatch>;
}
