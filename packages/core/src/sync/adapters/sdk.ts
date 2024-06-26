import {
  IncludedEncryptedNote,
  IncludedNote,
  Nullifier,
  IncludedNoteCommitment,
  IncludedNoteWithNullifier,
} from "../../primitives";
import { ClosableAsyncIterator } from "../closableAsyncIterator";
import { TotalEntityIndex, WithTotalEntityIndex } from "../totalEntityIndex";
import { IterSyncOpts } from "./shared";

interface BaseStateDiff {
  // new nullifiers in arbitrary order
  nullifiers: Nullifier[];

  // `latest merkle index of any new leaf to be synced. undefined if no new leaves were synced.
  latestNewlySyncedMerkleIndex: number | undefined;

  // `merkleIndex` of the last leaf to be committed to the commitment tree
  latestCommittedMerkleIndex: number | undefined;

  // `tei` of the latest commit to the commitment tree
  latestCommitTei: bigint | undefined;

  // last `TotalEntityIndex` of the range this StateDiff represents
  totalEntityIndex: TotalEntityIndex;
}

export interface EncryptedStateDiff extends BaseStateDiff {
  // new notes / encrypted notes corresponding to *non-empty* leaves
  // i.e. dummy leaves inserted by `fillBatchWithZeros` are left out
  // these must be sorted in ascending order by `merkleIndex`
  notes: WithTotalEntityIndex<IncludedNote | IncludedEncryptedNote>[];
}

export interface StateDiff extends BaseStateDiff {
  // new notes / note commitments corresponding to *non-empty* leaves
  // these must be sorted in ascending order by `merkleIndex`
  notesAndCommitments: WithTotalEntityIndex<
    IncludedNoteWithNullifier | IncludedNoteCommitment
  >[];
}

export interface SDKIterSyncOpts extends IterSyncOpts {
  // if true, the adapter will record and print performance times
  timing?: boolean;
}

export interface SDKSyncAdapter {
  // return an async iterator over state diffs in managably-sized chunks starting from `startTotalEntityIndex`
  // with notes / nfs when there's a lot of blocks to sync
  // By default, this iterator runs forever, yielding a state diff every `chunkSize` blocks have passed
  // If `opts.endBlock` is specified, the iterator will stop once the state diff ending at that block is emitted.
  //
  // If `opts.maxChunkSize` is specified, the adapter should never pull more than that many
  // blocks worth of updates into a single stateDiff. Implementations may pull in smaller
  // chunks.
  iterStateDiffs(
    startTotalEntityIndex: TotalEntityIndex,
    opts?: SDKIterSyncOpts
  ): ClosableAsyncIterator<EncryptedStateDiff>;

  // return the latest block the sync adapter can sync to
  getLatestIndexedBlock(): Promise<number>;

  // return the latest merkle index the sync adapter in any event up to `toBlock` the indexer has seen
  getLatestIndexedMerkleIndex(toBlock?: number): Promise<number | undefined>;
}
