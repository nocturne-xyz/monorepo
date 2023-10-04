import { TotalEntityIndex } from "../totalEntityIndex";

export interface IterSyncOpts {
  // totalEntityIndex to stop at
  // see `TotalEntityIndex` for more details
  endTotalEntityIndex?: TotalEntityIndex;
  // throttle the iterator to it will yield at most once every `throttleMs` milliseconds
  throttleMs?: number;

  // if set, iterator will only emit state diffs containing
  // data in blocks with at least this many confirmations
  finalityBlocks?: number;
}