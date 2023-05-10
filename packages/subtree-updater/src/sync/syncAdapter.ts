import { ClosableAsyncIterator, IterSyncOpts, Note } from "@nocturne-xyz/sdk";

export interface SubtreeUpdaterSyncAdapter {
  // iterate over insertions, pulling them by merkle index
  iterInsertions(
    startMerkleIndex: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<Note | bigint>;

  fetchLatestSubtreeIndex(): Promise<number>;
}
