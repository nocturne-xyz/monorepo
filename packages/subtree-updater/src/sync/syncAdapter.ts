import {
  ClosableAsyncIterator,
  IncludedNote,
  IncludedNoteCommitment,
  IterSyncOpts,
  TotalEntityIndex,
  WithTotalEntityIndex,
} from "@nocturne-xyz/core";

export type Insertion = IncludedNote | IncludedNoteCommitment;

export interface SubtreeUpdaterSyncAdapter {
  // iterate over insertions, pulling them by merkle index
  iterInsertions(
    startTotalEntityIndex: TotalEntityIndex,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<WithTotalEntityIndex<Insertion>[]>;

  fetchLatestSubtreeIndex(): Promise<number | undefined>;
}
