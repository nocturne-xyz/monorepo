import {
  ClosableAsyncIterator,
  IncludedNote,
  IncludedNoteCommitment,
  IterSyncOpts,
  TotalEntityIndex,
} from "@nocturne-xyz/sdk";

export interface SubtreeUpdaterSyncAdapter {
  // iterate over insertions, pulling them by merkle index
  iterInsertions(
    startTotalEntityIndex: TotalEntityIndex,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<IncludedNote | IncludedNoteCommitment>;

  fetchLatestSubtreeIndex(): Promise<number | undefined>;
}
