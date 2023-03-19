import { ClosableAsyncIterator } from "@nocturne-xyz/sdk";
import { DepositEvent, DepositEventType } from "../types";

// TODO: replace IterStateDiffOpts with below and import from SDK
export interface IterSyncOpts {
  endBlock?: number;
  maxChunkSize?: number;
}

export interface ScreenerSyncAdapter {
  iterDepositEvents(
    type: DepositEventType,
    startBlock: number,
    opts?: IterSyncOpts
  ): Promise<ClosableAsyncIterator<DepositEvent[]>>;
}
