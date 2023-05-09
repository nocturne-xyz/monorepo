import { ClosableAsyncIterator, IterSyncOpts } from "@nocturne-xyz/sdk";
import { IncludedNote, IncludedNoteCommitment } from "@nocturne-xyz/sdk";

export interface SubtreeUpdaterSyncAdapter {
  // iterate over insertions, pulling them by merkle index
  iterInsertions(
    startMerkleIndex: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<IncludedNote | IncludedNoteCommitment>;

  fetchLatestSubtreeIndex(): Promise<number>;
}
