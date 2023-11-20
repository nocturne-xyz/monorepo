import * as JSON from "bigint-json-serialization";
import {
  IncludedNote,
  IncludedNoteWithNullifier,
  KVStore,
  TotalEntityIndex,
  bigintToBEPadded,
  Address,
  SparseMerkleProver,
  StateDiff,
} from "@nocturne-xyz/core";
import { Mutex } from "async-mutex";
import { OpHistoryRecord } from "./types";

const SNAPSHOTS_KEY = "nocturne-client-snapshots";
const SNAPSHOT_KEY_PREFIX = "snapshot-";

// options for methods that get notes from the DB
// if includeUncommitted is defined and true, then the method include notes that are not yet committed to the commitment tree
// if ignoreOptimisticNFs is defined and true, then the method will include notes that have been used by the SDK, but may not have been nullified on-chain yet
// if both are undefined, then the method will only return notes that have been committed to the commitment tree and have not been used by the SDK yet
export interface GetNotesOpts {
  includeUncommitted?: boolean;
  ignoreOptimisticNFs?: boolean;
}

type Snapshot = {
  tei: bigint;
  teiOfLatestCommit: bigint;

  merkleIndexToNote: [number, IncludedNoteWithNullifier][];
  merkleIndexToTei: [number, TotalEntityIndex][];
  assetToMerkleIndices: [Address, number[]][];
  nfToMerkleIndex: [bigint, number][];

  optimisticNfIndices: number[];
  opHistory: Array<OpHistoryRecord>;

  serializedMerkle: string;
};

const snapshotMutex = new Mutex();

export class NocturneClientState {
  private tei?: TotalEntityIndex;
  private commitTei?: bigint;

  private merkleIndexToNote: Map<number, IncludedNoteWithNullifier>;
  private merkleIndexToTei: Map<number, TotalEntityIndex>;
  private assetToMerkleIndices: Map<Address, number[]>;
  private nfToMerkleIndex: Map<bigint, number>;

  private optimisticNfIndices: Set<number>;
  private opHistory: OpHistoryRecord[];

  public merkle: SparseMerkleProver;

  // used to persist the state
  private kv: KVStore;

  constructor(kv: KVStore) {
    this.kv = kv;

    this.merkleIndexToNote = new Map<number, IncludedNoteWithNullifier>();
    this.merkleIndexToTei = new Map<number, TotalEntityIndex>();
    this.assetToMerkleIndices = new Map<Address, number[]>();
    this.nfToMerkleIndex = new Map<bigint, number>();

    this.optimisticNfIndices = new Set<number>();
    this.opHistory = [];

    this.merkle = new SparseMerkleProver();
  }

  get currentTei(): TotalEntityIndex | undefined {
    return this.tei;
  }

  get teiOfLatestCommit(): TotalEntityIndex | undefined {
    return this.teiOfLatestCommit;
  }

  get latestSyncedMerkleIndex(): number | undefined {
    const countMinusOne = this.merkle.totalCount() - 1;
    if (countMinusOne < 0) {
      return undefined;
    }

    return countMinusOne;
  }

  get latestCommittedMerkleIndex(): number | undefined {
    const countMinusOne = this.merkle.count() - 1;
    if (countMinusOne < 0) {
      return undefined;
    }

    return countMinusOne;
  }

  getTeiForMerkleIndex(merkleIndex: number): TotalEntityIndex | undefined {
    return this.merkleIndexToTei.get(merkleIndex);
  }

  applyStateDiff(diff: StateDiff): Promise<number[]> {
    throw new Error("todo");
  }

  getBalanceForAsset(asset: Address, opts?: GetNotesOpts): bigint {
    const indices = this.assetToMerkleIndices.get(asset) ?? [];

    // TODO catch error and trigger recovery once we have events
    const notes = indices.map((i) => this.merkleIndexToNote.get(i)!);

    return this.filterNotesByOpts(notes, opts).reduce(
      (a, b) => a + b.value,
      0n
    );
  }

  getAllBalances(opts?: GetNotesOpts): Map<Address, bigint> {
    return new Map(
      [...this.assetToMerkleIndices.keys()].map((asset) => [
        asset,
        this.getBalanceForAsset(asset, opts),
      ])
    );
  }

  getNotesForAsset(asset: Address, opts?: GetNotesOpts): IncludedNote[] {
    const indices = this.assetToMerkleIndices.get(asset) ?? [];
    return this.filterNotesByOpts(
      indices.map((i) => this.merkleIndexToNote.get(i)!),
      opts
    );
  }

  getAllNotes(opts?: GetNotesOpts): Map<Address, IncludedNote[]> {
    return new Map(
      [...this.assetToMerkleIndices.entries()].map(([asset, indices]) => [
        asset,
        this.filterNotesByOpts(
          indices.map((i) => this.merkleIndexToNote.get(i)!),
          opts
        ),
      ])
    );
  }

  private filterNotesByOpts(
    notes: IncludedNote[],
    opts?: GetNotesOpts
  ): IncludedNote[] {
    if (!opts?.includeUncommitted) {
      const idx = this.latestCommittedMerkleIndex;
      if (idx === undefined) {
        return [];
      }

      notes = notes.filter((note) => note.merkleIndex <= idx);
    }

    if (!opts?.ignoreOptimisticNFs) {
      notes = notes.filter((note) =>
        this.optimisticNfIndices.has(note.merkleIndex)
      );
    }

    return notes;
  }

  private static async loadInner(
    kv: KVStore,
    snapshotKey: string
  ): Promise<NocturneClientState | undefined> {
    return await snapshotMutex.runExclusive(async () => {
      const serialized = await kv.getString(snapshotKey);
      if (!serialized) {
        return undefined;
      }

      const {
        merkleIndexToNote,
        merkleIndexToTei,
        assetToMerkleIndices,
        nfToMerkleIndex,

        optimisticNfIndices,
        opHistory,

        serializedMerkle,
        tei,
      }: Snapshot = JSON.parse(serialized);

      const state = new NocturneClientState(kv);
      state.tei = tei;
      state.commitTei = tei;

      state.merkle = SparseMerkleProver.deserialize(serializedMerkle);

      state.opHistory = opHistory;
      state.optimisticNfIndices = new Set(optimisticNfIndices);

      state.merkleIndexToNote = new Map(merkleIndexToNote);
      state.merkleIndexToTei = new Map(merkleIndexToTei);
      state.assetToMerkleIndices = new Map(assetToMerkleIndices);
      state.nfToMerkleIndex = new Map(nfToMerkleIndex);

      return state;
    });
  }

  static async load(
    kv: KVStore,
    snapshotTei?: TotalEntityIndex
  ): Promise<NocturneClientState> {
    return await snapshotMutex.runExclusive(async () => {
      const snapshotTeisSer = await kv.getString(SNAPSHOTS_KEY);
      if (!snapshotTeisSer) {
        return new NocturneClientState(kv);
      }
      const teis = JSON.parse(snapshotTeisSer) as bigint[];

      // edge case: if we get empty array here, return empty client state
      if (teis.length === 0) {
        return new NocturneClientState(kv);
      }

      // ensure TEIs are sorted
      teis.sort();
      await kv.putString(SNAPSHOTS_KEY, JSON.stringify(teis));

      // if we have a snapshot for the requested TEI, get it
      const hasSnapshotForTei = snapshotTei
        ? teis.find((tei) => tei === snapshotTei) !== undefined
        : false;
      if (snapshotTei && hasSnapshotForTei) {
        const state = await NocturneClientState.loadInner(
          kv,
          snapshotKey(snapshotTei)
        );
        if (!state) {
          throw new Error(`failed to load snapshot ${snapshotTei}`);
        }

        return state;
      }

      // otherwise, return the snapshot at the latest TEI < the requested one. If a TEI was not given, load the latest one
      // if no such snapshot exists, return empty state
      teis.reverse();
      const tei = snapshotTei ? teis.find((tei) => tei < snapshotTei) : teis[0];
      if (!tei) {
        return new NocturneClientState(kv);
      }

      const res = await NocturneClientState.loadInner(kv, snapshotKey(tei));
      if (!res) {
        throw new Error(`failed to load latest snapshot`);
      }

      return res;
    });
  }

  async snapshot(): Promise<void> {
    await snapshotMutex.runExclusive(async () => {
      // 1. clone state
      const state = structuredClone(this);

      // 2. set `tei` to `lastCommittedTei`
      // since `applyStateDiff` is idempotent, when we load from snapshot and re-sync, we'll get an equivalent state
      // (at worst, we end up with dangling NFs that don't point to anything, which is fine)
      // if this TEI is undefined, skip the snapshot because that implies it's empty
      state.tei = state.commitTei;
      if (!state.tei) {
        return;
      }

      // 3. prune uncommitted leaves from tree
      state.merkle.removeUncommitted();

      // 4. make snapshot
      const snapshot = {
        tei: state.tei,

        merkleIndexToNote: Array.from(state.merkleIndexToNote.entries()),
        merkleIndexToTei: Array.from(state.merkleIndexToNote.entries()),
        assetToMerkleIndices: Array.from(state.assetToMerkleIndices.entries()),
        nullifierToMerkleIndex: Array.from(state.nfToMerkleIndex.entries()),

        optimisticNfToMerkleIndex: Array.from(state.optimisticNfIndices),
        opHistory: state.opHistory,

        serializedMerkle: state.merkle.serialize(),
      };

      // 5. save it
      await this.kv.putString(
        snapshotKey(snapshot.tei),
        JSON.stringify(snapshot)
      );
    });
  }
}

function snapshotKey(tei: TotalEntityIndex): string {
  return SNAPSHOT_KEY_PREFIX + bigintToBEPadded(tei, 40, 16);
}
