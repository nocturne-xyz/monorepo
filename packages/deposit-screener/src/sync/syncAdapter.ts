import {
  ClosableAsyncIterator,
  IterSyncOpts,
  DepositEventType,
  DepositEvent,
  TotalEntityIndex,
} from "@nocturne-xyz/wallet-sdk";

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
