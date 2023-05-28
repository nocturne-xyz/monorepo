import {
  IncludedEncryptedNote,
  IncludedNote,
  Nullifier,
  IncludedNoteCommitment,
  IncludedNoteWithNullifier,
  WithTimestamp,
} from "../primitives";
import { ClosableAsyncIterator } from "./closableAsyncIterator";

interface BaseStateDiff {
  // new nullifiers in arbitrary order
  nullifiers: Nullifier[];

  // `merkleIndex` of the last leaf to be committed to the commitment tree
  lastCommittedMerkleIndex: number;

  // last block of the range this StateDiff represents
  blockNumber: number;
}

export interface EncryptedStateDiff extends BaseStateDiff {
  // new notes / encrypted notes corresponding to *non-empty* leaves
  // i.e. dummy leaves inserted by `fillBatchWithZeros` are left out
  // these must be sorted in ascending order by `merkleIndex`
  notes: WithTimestamp<IncludedNote | IncludedEncryptedNote>[];
}

export interface StateDiff extends BaseStateDiff {
  // new notes / note commitments corresponding to *non-empty* leaves
  // these must be sorted in ascending order by `merkleIndex`
  notesAndCommitments: WithTimestamp<
    IncludedNoteWithNullifier | IncludedNoteCommitment
  >[];
}

export interface IterSyncOpts {
  endBlock?: number;
  maxChunkSize?: number;
  // throttle the iterator to it will yield at most once every `throttleMs` milliseconds
  throttleMs?: number;
}

export interface SDKSyncAdapter {
  // return an async iterator over state diffs in managably-sized chunks starting from `startBlock`
  // with notes / nfs when there's a lot of blocks to sync
  // By default, this iterator runs forever, yielding a state diff every `chunkSize` blocks have passed
  // If `opts.endBlock` is specified, the iterator will stop once the state diff ending at that block is emitted.
  //
  // If `opts.maxChunkSize` is specified, the adapter should never pull more than that many
  // blocks worth of updates into a single stateDiff. Implementations may pull in smaller
  // chunks.
  iterStateDiffs(
    startBlock: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<EncryptedStateDiff>;
}
