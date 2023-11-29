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
  OperationStatus,
  PreSignOperation,
  SignedOperation,
  OperationTrait,
  unzip,
  Nullifier,
  NoteTrait,
  WithTotalEntityIndex,
  IncludedNoteCommitment,
  consecutiveChunks,
  MerkleIndex,
  Asset,
  AssetTrait,
} from "@nocturne-xyz/core";
import { Mutex } from "async-mutex";
import { OpHistoryRecord, OperationMetadata } from "./types";
import {
  OPTIMISTIC_RECORD_TTL,
  getMerkleIndicesAndNfsFromOp,
  isTerminalOpStatus,
} from "./utils";

const SNAPSHOTS_KEY = "nocturne-client-snapshots";
const SNAPSHOT_KEY_PREFIX = "snapshot-";

export const __private = {
  snapshotKey,
};

// options for methods that get notes from the DB
// if includeUncommitted is defined and true, then the method include notes that are not yet committed to the commitment tree
// if ignoreOptimisticNfs is defined and true, then the method will include notes that have been used by the SDK, but may not have been nullified on-chain yet
// if both are undefined, then the method will only return notes that have been committed to the commitment tree and have not been used by the SDK yet
export type GetNotesOpts = {
  includeUncommitted?: boolean;
  ignoreOptimisticNfs?: boolean;
};

type ExpirationDate = number;
type SerializedAsset = string;

type Snapshot = {
  tei?: bigint;
  teiOfLatestCommit?: bigint;

  merkleIndexToNote: [number, IncludedNoteWithNullifier][];
  merkleIndexToTei: [number, TotalEntityIndex][];
  assetToMerkleIndices: [SerializedAsset, number[]][];
  nfToMerkleIndex: [bigint, number][];

  optimisticNfs: [MerkleIndex, ExpirationDate][];
  opHistory: OpHistoryRecord[];

  latestCommittedMerkleIndex?: number;
  latestSyncedMerkleIndex?: number;
  serializedMerkle: string;
};

const snapshotMutex = new Mutex();

export class NocturneClientState {
  private tei?: TotalEntityIndex;
  private commitTei?: bigint;

  // TODO track these via tree
  private _latestSyncedMerkleIndex?: number;
  private _latestCommittedMerkleIndex?: number;

  // TODO find another home for this
  assetAddrToAsset: Map<Address, Asset>;

  private merkleIndexToNote: Map<MerkleIndex, IncludedNoteWithNullifier>;
  private merkleIndexToTei: Map<MerkleIndex, TotalEntityIndex>;
  private assetToMerkleIndices: Map<SerializedAsset, MerkleIndex[]>;
  private nfToMerkleIndex: Map<Nullifier, MerkleIndex>;

  private optimisticNfs: Map<MerkleIndex, ExpirationDate>;
  private _opHistory: OpHistoryRecord[];

  public merkle: SparseMerkleProver;

  // used to persist the state
  public kv: KVStore;

  constructor(kv: KVStore) {
    this.kv = kv;

    this.assetAddrToAsset = new Map<Address, Asset>();
    this.merkleIndexToNote = new Map<MerkleIndex, IncludedNoteWithNullifier>();
    this.merkleIndexToTei = new Map<MerkleIndex, TotalEntityIndex>();
    this.assetToMerkleIndices = new Map<SerializedAsset, MerkleIndex[]>();
    this.nfToMerkleIndex = new Map<Nullifier, MerkleIndex>();

    this.optimisticNfs = new Map<MerkleIndex, ExpirationDate>();
    this._opHistory = [];

    this.merkle = new SparseMerkleProver();
  }

  // *** TEIs and Merkle Indices ***

  get currentTei(): TotalEntityIndex | undefined {
    return this.tei;
  }

  get teiOfLatestCommit(): TotalEntityIndex | undefined {
    return this.commitTei;
  }

  get latestSyncedMerkleIndex(): number | undefined {
    return this._latestSyncedMerkleIndex;
  }

  get latestCommittedMerkleIndex(): number | undefined {
    return this._latestCommittedMerkleIndex;
  }

  get merkleRoot(): bigint {
    return this.merkle.getRoot();
  }

  getTeiForMerkleIndex(merkleIndex: number): TotalEntityIndex | undefined {
    return this.merkleIndexToTei.get(merkleIndex);
  }

  // *** APPLY STATE DIFF

  applyStateDiff(diff: StateDiff): number[] {
    const {
      notesAndCommitments,
      nullifiers,
      latestCommittedMerkleIndex,
      latestNewlySyncedMerkleIndex,
      totalEntityIndex,
    } = diff;

    // 1. store new notes + nfs
    this.storeNewNotes(notesAndCommitments);

    // 2. apply new nullifiers to notes
    // NOTE: this comes after storing notes because new notes can be nullified in the same state diff
    const nfIndices = this.nullifyNotes(nullifiers);

    // 3. update tree
    this.updateMerkle(
      notesAndCommitments.map(({ inner }) => inner),
      nfIndices,
      latestCommittedMerkleIndex
    );

    // 4. update TEI map
    for (const { inner, totalEntityIndex } of notesAndCommitments) {
      this.merkleIndexToTei.set(inner.merkleIndex, totalEntityIndex);
    }

    // 5. update TEI
    // TODO add commitTei to state diff
    this.commitTei = totalEntityIndex;
    this.tei = totalEntityIndex;

    // 6. set indices
    if (latestNewlySyncedMerkleIndex !== undefined) {
      this._latestSyncedMerkleIndex = latestNewlySyncedMerkleIndex;
    }
    if (latestCommittedMerkleIndex !== undefined) {
      this._latestCommittedMerkleIndex = latestCommittedMerkleIndex;
    }

    return nfIndices;
  }

  private storeNewNotes(
    notesAndCommitments: WithTotalEntityIndex<
      IncludedNoteWithNullifier | IncludedNoteCommitment
    >[]
  ): void {
    const notesToStore = notesAndCommitments.filter(
      ({ inner }) =>
        !NoteTrait.isCommitment(inner) &&
        (inner as IncludedNoteWithNullifier).value > 0n
    ) as WithTotalEntityIndex<IncludedNoteWithNullifier>[];

    for (const { inner: note } of notesToStore) {
      // a. set the entry in `merkleIndexToNote` to the new note no matter what, even if there's something already there
      const alreadyHasNote = this.merkleIndexToNote.has(note.merkleIndex);
      this.merkleIndexToNote.set(note.merkleIndex, note);

      // b. add to `assetToMerkleIndices` map if it's not already there
      const serializedAsset = AssetTrait.serializeCompactString(note.asset);
      const merkleIndices =
        this.assetToMerkleIndices.get(serializedAsset) ?? [];
      if (!merkleIndices.includes(note.merkleIndex)) {
        merkleIndices.push(note.merkleIndex);
        this.assetToMerkleIndices.set(serializedAsset, merkleIndices);

        if (alreadyHasNote) {
          console.warn(
            `note ${note.merkleIndex} already exists in note map but is not in asset map`
          );
        }
      }

      // c. add the nullifiers to the `nfToMerkleIndex` map
      this.nfToMerkleIndex.set(note.nullifier, note.merkleIndex);
    }
  }

  // TODO make this more efficient / less contrived
  private nullifyNotes(nfs: Nullifier[]): number[] {
    const nfIndices: number[] = [];
    for (const nf of nfs) {
      // strategy:
      // 1. remove merkle index from asset => merkle indices map
      // 2. remove nf => merkle map entry

      // if the nf isn't in the map, skip it as it's not ours
      const merkleIndex = this.nfToMerkleIndex.get(nf);
      if (merkleIndex === undefined) {
        continue;
      }

      const note = this.merkleIndexToNote.get(merkleIndex);
      if (note === undefined) {
        console.error(
          `merkle index ${merkleIndex} not found in merkleIndexToNote - client is in an inconsistent state!`
        );
        // TODO: do we throw an error here?
        // TODO: trigger recovery once we have events
        continue;
      }

      if (note.nullifier !== nf) {
        console.error(
          `note at merkle index has a different nullifier - client is in an inconsistent state!`
        );
        // TODO: do we throw an error here?
        // TODO: trigger recovery once we have events

        continue;
      }

      const serializedAsset = AssetTrait.serializeCompactString(note.asset);
      const assetIndices = this.assetToMerkleIndices.get(serializedAsset);
      if (assetIndices === undefined) {
        console.error(
          `asset ${note.asset.assetAddr} not found in assetToMerkleIndices - client is in an inconsistent state!`
        );
        // TODO: do we throw an error here?
        // TODO: trigger recovery once we have events
        continue;
      }

      const index = assetIndices.findIndex((i) => i === merkleIndex);
      if (index < 0) {
        console.error(
          `merkle index ${merkleIndex} not found in assetToMerkleIndices - client is in an inconsistent state!`
        );
        // TODO: do we throw an error here?
        // TODO: trigger recovery once we have events
        continue;
      }

      assetIndices.splice(index, 1);
      if (assetIndices.length < 1) {
        this.assetToMerkleIndices.delete(serializedAsset);
      } else {
        this.assetToMerkleIndices.set(serializedAsset, assetIndices);
      }

      nfIndices.push(merkleIndex);
      this.nfToMerkleIndex.delete(nf);
    }

    return nfIndices;
  }

  private updateMerkle(
    notesAndCommitments: (IncludedNote | IncludedNoteCommitment)[],
    nfIndices: number[],
    commitUpTo?: number
  ): void {
    // add all new leaves as uncommitted leaves
    const treeTip = this.merkle.totalCount();
    const batches = consecutiveChunks(
      // filter out insertions with merkle index < tree count
      // TODO: make tree idempotent instead
      notesAndCommitments.filter(({ merkleIndex }) => merkleIndex >= treeTip),
      ({ merkleIndex }) => merkleIndex
    );

    for (const batch of batches) {
      const startIndex = batch[0].merkleIndex;
      const leaves = [];
      const includes = [];
      for (const noteOrCommitment of batch) {
        if (NoteTrait.isCommitment(noteOrCommitment)) {
          leaves.push(
            (noteOrCommitment as IncludedNoteCommitment).noteCommitment
          );
          includes.push(false);
        } else {
          leaves.push(NoteTrait.toCommitment(noteOrCommitment as IncludedNote));
          includes.push(true);
        }
      }
      this.merkle.insertBatchUncommitted(startIndex, leaves, includes);
    }

    // commit up to latest subtree commit if
    if (commitUpTo !== undefined) {
      this.merkle.commitUpToIndex(commitUpTo);
    }

    // mark nullified ones for pruning
    for (const index of nfIndices) {
      this.merkle.markForPruning(index);
    }
  }

  // *** NOTE FETCHING METHODS ***

  getBalanceForAsset(asset: Asset, opts?: GetNotesOpts): bigint {
    const serializedAsset = AssetTrait.serializeCompactString(asset);
    const indices = this.assetToMerkleIndices.get(serializedAsset) ?? [];

    // TODO catch error and trigger recovery once we have events
    const notes = indices.map((i) => this.merkleIndexToNote.get(i)!);

    return this.filterNotesByOpts(notes, opts).reduce(
      (a, b) => a + b.value,
      0n
    );
  }

  getAllBalances(opts?: GetNotesOpts): Map<Asset, bigint> {
    return new Map(
      [...this.assetToMerkleIndices.keys()].map((serializedAsset) => {
        const asset = AssetTrait.deserializeCompactString(serializedAsset);
        return [asset, this.getBalanceForAsset(asset, opts)];
      })
    );
  }

  getNotesForAsset(asset: Asset, opts?: GetNotesOpts): IncludedNote[] {
    const serializedAsset = AssetTrait.serializeCompactString(asset);
    const indices = this.assetToMerkleIndices.get(serializedAsset) ?? [];
    return this.filterNotesByOpts(
      indices
        .map((i) => this.merkleIndexToNote.get(i)!)
        .map(({ nullifier, ...includedNote }) => includedNote),
      opts
    );
  }

  getAllNotes(opts?: GetNotesOpts): Map<Asset, IncludedNote[]> {
    return new Map(
      [...this.assetToMerkleIndices.entries()].map(([asset, indices]) => [
        AssetTrait.deserializeCompactString(asset),
        this.filterNotesByOpts(
          indices
            .map((i) => this.merkleIndexToNote.get(i)!)
            .map(({ nullifier, ...includedNote }) => includedNote),
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

    if (!opts?.ignoreOptimisticNfs) {
      notes = notes.filter((note) => !this.optimisticNfs.has(note.merkleIndex));
    }

    return notes;
  }

  // *** HISTORY METHODS ***

  get opHistory(): OpHistoryRecord[] {
    return this._opHistory;
  }

  get pendingOps(): OpHistoryRecord[] {
    return this._opHistory.filter(
      (record) => !record.status || !isTerminalOpStatus(record.status)
    );
  }

  get previousOps(): OpHistoryRecord[] {
    return this._opHistory.filter(
      (record) => record.status && isTerminalOpStatus(record.status)
    );
  }

  getOpHistoryRecord(digest: bigint): OpHistoryRecord | undefined {
    return this.opHistory.find((record) => record.digest === digest);
  }

  setStatusForOp(digest: bigint, status: OperationStatus): void {
    const idx = this.opHistory.findIndex((record) => record.digest === digest);
    if (idx < 0) {
      console.warn("op history record not found");
      return;
    }

    this._opHistory[idx].status = status;
  }

  addOpToHistory(
    op: PreSignOperation | SignedOperation,
    metadata: OperationMetadata,
    status?: OperationStatus
  ): void {
    const digest = OperationTrait.computeDigest(op);

    // see if op already exists. if so, skip
    if (this.getOpHistoryRecord(digest) !== undefined) {
      return;
    }

    const pairs: [number, bigint][] = getMerkleIndicesAndNfsFromOp(op).map(
      ({ merkleIndex, nullifier }) => [Number(merkleIndex), nullifier]
    );
    const [spentNoteMerkleIndices] = unzip(pairs);
    const now = Date.now();

    const record = {
      digest,
      metadata,
      status,
      spentNoteMerkleIndices,
      createdAt: now,
      lastModified: now,
    };
    this._opHistory.push(record);

    const expirationDate = now + OPTIMISTIC_RECORD_TTL;
    for (const idx of spentNoteMerkleIndices) {
      this.optimisticNfs.set(idx, expirationDate);
    }
  }

  removeOpFromHistory(digest: bigint, removeOptimisticNfs?: boolean): void {
    const index = this.opHistory.findIndex(
      (record) => record.digest === digest
    );
    if (index === -1) {
      return;
    }

    this.opHistory.splice(index, 1);
  }

  /// *** OPTIMISTIC NULLIFIER METHODS ***

  pruneOptimisticNFs(): void {
    const now = Date.now();
    for (const [merkleIndex, expirationDate] of this.optimisticNfs.entries()) {
      if (now > expirationDate) {
        this.optimisticNfs.delete(merkleIndex);
      }
    }
  }

  // *** SNAPSHOT METHODS ***

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

  async save(): Promise<void> {
    await snapshotMutex.runExclusive(async () => {
      const state = this.clone();

      // skip empty snapshots
      const snapshotTei = state.tei;
      if (snapshotTei === undefined) {
        return;
      }

      // TODO prune uncommitted leaves from tree and use `commitTei` instead of `tei` in snapshot

      // make snapshot
      const snapshot: Snapshot = {
        tei: snapshotTei,
        teiOfLatestCommit: state.commitTei,

        merkleIndexToNote: Array.from(state.merkleIndexToNote.entries()),
        merkleIndexToTei: Array.from(state.merkleIndexToTei.entries()),
        assetToMerkleIndices: Array.from(state.assetToMerkleIndices.entries()),
        nfToMerkleIndex: Array.from(state.nfToMerkleIndex.entries()),

        optimisticNfs: Array.from(state.optimisticNfs),
        opHistory: state._opHistory,

        latestCommittedMerkleIndex: state._latestCommittedMerkleIndex,
        latestSyncedMerkleIndex: state._latestSyncedMerkleIndex,
        serializedMerkle: state.merkle.serialize(),
      };

      // 5. save it
      await this.kv.putString(
        snapshotKey(snapshotTei),
        JSON.stringify(snapshot)
      );

      // add it to list of snapshots
      const snapshotTeisSer = await this.kv.getString(SNAPSHOTS_KEY);
      const snapshotTeis = snapshotTeisSer
        ? JSON.parse(snapshotTeisSer)
        : ([] as bigint[]);

      if (snapshotTeis.includes(snapshotTei)) {
        return;
      }

      snapshotTeis.push(snapshotTei);
      await this.kv.putString(SNAPSHOTS_KEY, JSON.stringify(snapshotTeis));
    });
  }

  clone(): NocturneClientState {
    const state = new NocturneClientState(this.kv);

    state.tei = this.tei;
    state.commitTei = this.commitTei;

    state._latestCommittedMerkleIndex = this._latestCommittedMerkleIndex;
    state._latestSyncedMerkleIndex = this._latestSyncedMerkleIndex;
    state.merkle = this.merkle.clone();

    state._opHistory = structuredClone(this._opHistory);
    state.optimisticNfs = structuredClone(this.optimisticNfs);

    state.merkleIndexToNote = structuredClone(this.merkleIndexToNote);
    state.merkleIndexToTei = structuredClone(this.merkleIndexToTei);
    state.assetToMerkleIndices = structuredClone(this.assetToMerkleIndices);
    state.nfToMerkleIndex = structuredClone(this.nfToMerkleIndex);

    return state;
  }

  // clears the underlying KV completely, including all snapshots.
  // TODO: make this more granular
  async clear(): Promise<void> {
    await this.kv.clear();
  }

  private static async loadInner(
    kv: KVStore,
    snapshotKey: string
  ): Promise<NocturneClientState | undefined> {
    const serialized = await kv.getString(snapshotKey);
    if (!serialized) {
      return undefined;
    }

    const {
      merkleIndexToNote,
      merkleIndexToTei,
      assetToMerkleIndices,
      nfToMerkleIndex,

      optimisticNfs,
      opHistory,

      serializedMerkle,
      tei,

      latestSyncedMerkleIndex,
      latestCommittedMerkleIndex,
    }: Snapshot = JSON.parse(serialized);

    const state = new NocturneClientState(kv);
    state.tei = tei;
    state.commitTei = tei;

    state._latestCommittedMerkleIndex = latestCommittedMerkleIndex;
    state._latestSyncedMerkleIndex = latestSyncedMerkleIndex;
    state.merkle = SparseMerkleProver.deserialize(serializedMerkle);

    state._opHistory = opHistory;
    state.optimisticNfs = new Map(optimisticNfs);

    state.merkleIndexToNote = new Map(merkleIndexToNote);
    state.merkleIndexToTei = new Map(merkleIndexToTei);
    state.assetToMerkleIndices = new Map(assetToMerkleIndices);
    state.nfToMerkleIndex = new Map(nfToMerkleIndex);

    return state;
  }

  /// *** getters for test purposes ***

  get __merkleIndexToNote(): Map<MerkleIndex, IncludedNoteWithNullifier> {
    return this.merkleIndexToNote;
  }

  get __merkleIndexToTei(): Map<MerkleIndex, TotalEntityIndex> {
    return this.merkleIndexToTei;
  }

  get __assetToMerkleIndices(): Map<SerializedAsset, MerkleIndex[]> {
    return this.assetToMerkleIndices;
  }

  get __nfToMerkleIndex(): Map<Nullifier, MerkleIndex> {
    return this.nfToMerkleIndex;
  }

  get __optimisticNfs(): Map<MerkleIndex, ExpirationDate> {
    return this.optimisticNfs;
  }

  get __merkle(): SparseMerkleProver {
    return this.merkle;
  }
}

function snapshotKey(tei: TotalEntityIndex): string {
  return (
    SNAPSHOT_KEY_PREFIX +
    bigintToBEPadded(tei, 40)
      .map((n) => n.toString(16))
      .join("")
  );
}
