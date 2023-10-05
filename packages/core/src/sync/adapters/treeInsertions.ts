import { IncludedNote, IncludedNoteCommitment } from "../../primitives";
import { IterSyncOpts } from "./shared";
import { ClosableAsyncIterator } from "../closableAsyncIterator";

export type Insertion = IncludedNote | IncludedNoteCommitment;

export interface TreeInsertionSyncOpts extends IterSyncOpts {
  throttleOnEmptyMs?: number;
}

export interface TreeInsertionSyncAdapter {
  // iterate over insertions, pulling them by merkle index
  iterInsertions(
    startMerkleIndex: number,
    opts?: TreeInsertionSyncOpts
  ): ClosableAsyncIterator<Insertion[]>;
}
