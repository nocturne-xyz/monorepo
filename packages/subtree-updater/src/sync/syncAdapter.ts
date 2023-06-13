import {
  ClosableAsyncIterator,
  IncludedNote,
  IncludedNoteCommitment,
  IterSyncOpts,
} from "@nocturne-xyz/sdk";

export interface SubtreeUpdaterSyncAdapter {
  // iterate over insertions, pulling them by merkle index
  iterInsertions(
    startBlock: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<IncludedNote | IncludedNoteCommitment>;

  fetchLatestSubtreeIndex(): Promise<number | undefined>;
}
