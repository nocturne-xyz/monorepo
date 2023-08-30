import {
  ClosableAsyncIterator,
  IncludedNote,
  IncludedNoteCommitment,
  IterSyncOpts,
} from "@nocturne-xyz/core";

export type Insertion = IncludedNote | IncludedNoteCommitment;

export interface TreeInsertionSyncAdapter {
  // iterate over insertions, pulling them by merkle index
  iterInsertions(
    startMerkleIndex: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<Insertion[]>;
}
