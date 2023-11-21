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
} from "@nocturne-xyz/core";
import { Mutex } from "async-mutex";
import { OpHistoryRecord, OperationMetadata } from "./types";
import { OPTIMISTIC_RECORD_TTL, getMerkleIndicesAndNfsFromOp } from "./utils";

const SNAPSHOTS_KEY = "nocturne-client-snapshots";
const SNAPSHOT_KEY_PREFIX = "snapshot-";

// options for methods that get notes from the DB
// if includeUncommitted is defined and true, then the method include notes that are not yet committed to the commitment tree
// if ignoreOptimisticNFs is defined and true, then the method will include notes that have been used by the SDK, but may not have been nullified on-chain yet
// if both are undefined, then the method will only return notes that have been committed to the commitment tree and have not been used by the SDK yet
export type GetNotesOpts = {
  includeUncommitted?: boolean;
  ignoreOptimisticNFs?: boolean;
};

type ExpirationDate = number;

type Snapshot = {
  tei: bigint;
  teiOfLatestCommit: bigint;

  merkleIndexToNote: [number, IncludedNoteWithNullifier][];
  merkleIndexToTei: [number, TotalEntityIndex][];
  assetToMerkleIndices: [Address, number[]][];
  nfToMerkleIndex: [bigint, number][];

  optimisticNfs: [MerkleIndex, ExpirationDate][];
  opHistory: OpHistoryRecord[];

  serializedMerkle: string;
};

const snapshotMutex = new Mutex();

export class NocturneClientState {
  private tei?: TotalEntityIndex;
  private commitTei?: bigint;

  private merkleIndexToNote: Map<MerkleIndex, IncludedNoteWithNullifier>;
  private merkleIndexToTei: Map<MerkleIndex, TotalEntityIndex>;
  private assetToMerkleIndices: Map<Address, MerkleIndex[]>;
  private nfToMerkleIndex: Map<Nullifier, MerkleIndex>;

  private optimisticNfs: Map<MerkleIndex, ExpirationDate>;
  private _opHistory: OpHistoryRecord[];

  public merkle: SparseMerkleProver;

  // used to persist the state
  private kv: KVStore;

  constructor(kv: KVStore) {
    this.kv = kv;

    this.merkleIndexToNote = new Map<MerkleIndex, IncludedNoteWithNullifier>();
    this.merkleIndexToTei = new Map<MerkleIndex, TotalEntityIndex>();
    this.assetToMerkleIndices = new Map<Address, MerkleIndex[]>();
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

  // *** APPLY STATE DIFF

  applyStateDiff(diff: StateDiff): number[] {
    const {
      notesAndCommitments,
      nullifiers,
      latestCommittedMerkleIndex,
      totalEntityIndex,
    } = diff;

    // 1. store new notes + nfs
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
      const merkleIndices =
        this.assetToMerkleIndices.get(note.asset.assetAddr) ?? [];
      if (!merkleIndices.includes(note.merkleIndex)) {
        merkleIndices.push(note.merkleIndex);
        this.assetToMerkleIndices.set(note.asset.assetAddr, merkleIndices);

        if (alreadyHasNote) {
          console.warn(
            `note ${note.merkleIndex} already exists in note map but is not in asset map`
          );
        }
      }

      // c. add the nullifiers to the `nfToMerkleIndex` map
      this.nfToMerkleIndex.set(note.nullifier, note.merkleIndex);
    }

    // 2. apply new nullifiers to notes
    // NOTE: this comes after storing notes because new notes can be nullified in the same state diff
    // TODO make this more efficient / less contrived

    const nfIndices: number[] = [];
    for (const nf of nullifiers) {
      // 1. remove merkle index from asset => merkle indices map
      // 2. remove nf => merkle map entry
      const merkleIndex = this.nfToMerkleIndex.get(nf);
      if (merkleIndex === undefined) {
        console.error(
          `nullifier ${nf} not found in nfToMerkleIndex - client is in an incosistent state!`
        );
        // TODO: do we throw an error here?
        // TODO: trigger recovery once we have events
        continue;
      }

      const note = this.merkleIndexToNote.get(merkleIndex);
      if (note === undefined) {
        console.error(
          `merkle index ${merkleIndex} not found in merkleIndexToNote - client is in an incosistent state!`
        );
        // TODO: do we throw an error here?
        // TODO: trigger recovery once we have events
        continue;
      }

      const assetIndices = this.assetToMerkleIndices.get(note.asset.assetAddr);
      if (assetIndices === undefined) {
        console.error(
          `asset ${note.asset.assetAddr} not found in assetToMerkleIndices - client is in an incosistent state!`
        );
        // TODO: do we throw an error here?
        // TODO: trigger recovery once we have events
        continue;
      }

      const index = assetIndices.findIndex((i) => i === merkleIndex);
      if (index < 0) {
        console.error(
          `merkle index ${merkleIndex} not found in assetToMerkleIndices - client is in an incosistent state!`
        );
        // TODO: do we throw an error here?
        // TODO: trigger recovery once we have events
        continue;
      }

      assetIndices.splice(index, 1);
      if (assetIndices.length < 1) {
        this.assetToMerkleIndices.delete(note.asset.assetAddr);
      } else {
        this.assetToMerkleIndices.set(note.asset.assetAddr, assetIndices);
      }

      nfIndices.push(merkleIndex);
      this.nfToMerkleIndex.delete(nf);
    }

    // 3. update tree
    this.updateMerkle(
      notesAndCommitments.map(({ inner }) => inner),
      nfIndices,
      latestCommittedMerkleIndex
    );

    // 4. update TEI
    this.tei = totalEntityIndex;

    return nfIndices;
  }

  updateMerkle(
    notesAndCommitments: (IncludedNote | IncludedNoteCommitment)[],
    nfIndices: number[],
    commitUpTo?: number
  ): void {
    // add all new leaves as uncommitted leaves
    const batches = consecutiveChunks(
      notesAndCommitments,
      (noteOrCommitment) => noteOrCommitment.merkleIndex
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
      notes = notes.filter((note) => !this.optimisticNfs.has(note.merkleIndex));
    }

    return notes;
  }

  // *** HISTORY METHODS ***

  get opHistory(): OpHistoryRecord[] {
    return this.opHistory;
  }

  getOpHistoryRecord(digest: bigint): OpHistoryRecord | undefined {
    return this.opHistory.find((record) => record.digest === digest);
  }

  // idempotent
  setStatusForOp(digest: bigint, status: OperationStatus): void {
    const idx = this.opHistory.findIndex((record) => record.digest === digest);
    if (idx < 0) {
      console.warn("op history record not found");
      return;
    }

    this._opHistory[idx].status = status;
  }

  // idempotent
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
    this.opHistory.push(record);

    const expirationDate = now + OPTIMISTIC_RECORD_TTL;
    for (const idx of spentNoteMerkleIndices) {
      this.optimisticNfs.set(idx, expirationDate);
    }
  }

  // idempotent
  removeOpfromHistory(digest: bigint, removeOptimisticNfs?: boolean): void {
    const index = this.opHistory.findIndex(
      (record) => record.digest === digest
    );
    if (index === -1) {
      return;
    }

    this.opHistory.splice(index, 1);
  }

  // *** SNAPSHOT METHODS ***

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

        optimisticNfs,
        opHistory,

        serializedMerkle,
        tei,
      }: Snapshot = JSON.parse(serialized);

      const state = new NocturneClientState(kv);
      state.tei = tei;
      state.commitTei = tei;

      state.merkle = SparseMerkleProver.deserialize(serializedMerkle);

      state._opHistory = opHistory;
      state.optimisticNfs = new Map(optimisticNfs);

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
      // clone state
      const state = structuredClone(this);

      // HACK: set `tei` to `lastCommittedTei`
      // we do this because we want to snapshot the state of the tree at the point of the latest committed merkle index
      // this is because we only have the capability of checking the correctness of the tree by comparing to the onchain root
      // we can't check whether or not the uncommitted insertions afterwards match the contract's state because that state isn't public
      // therefore, we only snapshot the state of the tree at the point of the latest commit, at which point we can be sure that it matches the contract's on-chain state
      // since `applyStateDiff` is idempotent, when we load from snapshot and re-sync, we'll get an equivalent state
      // (at worst, we end up with dangling NFs that don't point to anything, which is fine)
      // if this TEI is undefined, skip the snapshot because that implies it's empty
      state.tei = state.commitTei;
      if (!state.tei) {
        return;
      }

      // prune uncommitted leaves from tree
      state.merkle.removeUncommitted();

      // make snapshot
      const snapshot: Snapshot = {
        tei: state.tei,
        teiOfLatestCommit: state.tei,

        merkleIndexToNote: Array.from(state.merkleIndexToNote.entries()),
        merkleIndexToTei: Array.from(state.merkleIndexToTei.entries()),
        assetToMerkleIndices: Array.from(state.assetToMerkleIndices.entries()),
        nfToMerkleIndex: Array.from(state.nfToMerkleIndex.entries()),

        optimisticNfs: Array.from(state.optimisticNfs),
        opHistory: state._opHistory,

        serializedMerkle: state.merkle.serialize(),
      };

      // 5. save it
      await this.kv.putString(
        snapshotKey(snapshot.tei),
        JSON.stringify(snapshot)
      );
    });
  }

  /// *** getters for test purposes ***
  get __merkleIndexToNote(): Map<MerkleIndex, IncludedNoteWithNullifier> {
    return this.merkleIndexToNote;
  }

  get __merkleIndexToTei(): Map<MerkleIndex, TotalEntityIndex> {
    return this.merkleIndexToTei;
  }

  get __assetToMerkleIndices(): Map<Address, MerkleIndex[]> {
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
