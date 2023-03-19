import { ClosableAsyncIterator, IterSyncOpts } from "@nocturne-xyz/sdk";
import { DepositEvent, DepositEventType } from "../types";

export interface ScreenerSyncAdapter {
  iterDepositEvents(
    type: DepositEventType,
    startBlock: number,
    opts?: IterSyncOpts
  ): Promise<ClosableAsyncIterator<DepositEvent[]>>;
}
