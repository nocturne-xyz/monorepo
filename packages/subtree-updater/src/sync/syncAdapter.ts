import { ClosableAsyncIterator, IterSyncOpts } from "@nocturne-xyz/sdk";
import { IncludedNote, IncludedNoteCommitment } from "@nocturne-xyz/sdk";

export interface SubtreeUpdaterSyncAdapter {
  iterDepositEvents(
    startBlock: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<IncludedNote | IncludedNoteCommitment>;
}
