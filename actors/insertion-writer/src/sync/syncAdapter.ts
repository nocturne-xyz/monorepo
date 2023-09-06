import { ClosableAsyncIterator, IterSyncOpts } from "@nocturne-xyz/core";
import { Insertion } from "@nocturne-xyz/persistent-log";

export interface TreeInsertionSyncAdapter {
  // iterate over insertions, pulling them by merkle index
  iterInsertions(
    startMerkleIndex: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<Insertion[]>;
}
