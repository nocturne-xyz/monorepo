import { ClosableAsyncIterator, IterSyncOpts } from "@nocturne-xyz/sdk";
import { DepositEvent, DepositEventType } from "../types";

export interface DepositEventsBatch {
  blockNumber: number;
  depositEvents: DepositEvent[];
}

export interface StreamAdapter {
  iterDepositEvents(
    type: DepositEventType,
    startBlock: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<DepositEventsBatch>;
}
