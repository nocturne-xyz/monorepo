import { ethers } from "ethers";
import {
  OptimisticNFRecord,
  OpHistoryRecord,
  OperationMetadata,
} from "./types";
import * as JSON from "bigint-json-serialization";
import {
  Asset,
  AssetTrait,
  IncludedNote,
  NoteTrait,
  IncludedNoteWithNullifier,
  numberToStringPadded,
  KV,
  KVStore,
  StateDiff,
  TotalEntityIndex,
  WithTotalEntityIndex,
  OperationStatus,
  unzip,
  OperationTrait,
  PreSignOperation,
  SignedOperation,
} from "@nocturne-xyz/core";
import { Mutex } from "async-mutex";
import {
  OPTIMISTIC_RECORD_TTL,
  getMerkleIndicesAndNfsFromOp,
  isFailedOpStatus,
  isTerminalOpStatus,
} from "./utils";

const NOTES_BY_INDEX_PREFIX = "NOTES_BY_INDEX";
const NOTES_BY_ASSET_PREFIX = "NOTES_BY_ASSET";
const NOTES_BY_NULLIFIER_PREFIX = "NOTES_BY_NULLIFIER";
const MERKLE_INDEX_TIMESTAMP_PREFIX = "MERKLE_INDEX_TIMESTAMP";
const OPTIMISTIC_NF_RECORD_PREFIX = "OPTIMISTIC_NF_RECORD";
const CURRENT_TOTAL_ENTITY_INDEX_KEY = "CURRENT_TOTAL_ENTITY_INDEX";
const LAST_COMMITTED_MERKLE_INDEX_KEY = "LAST_COMMITTED_MERKLE_INDEX";
const LAST_SYNCED_MERKLE_INDEX_KEY = "LAST_SYNCED_MERKLE_INDEX";
const OP_HISTORY_KEY = "OP_HISTORY";
const OP_DIGEST_PREFIX = "OP_DIGEST_";

// ceil(log10(2^32))
const MAX_MERKLE_INDEX_DIGITS = 10;

export type AssetKey = string;
type AllNotes = Map<AssetKey, IncludedNote[]>;

// options for methods that get notes from the DB
// if includeUncommitted is defined and true, then the method include notes that are not yet committed to the commitment tree
// if ignoreOptimisticNFs is defined and true, then the method will include notes that have been used by the SDK, but may not have been nullified on-chain yet
// if both are undefined, then the method will only return notes that have been committed to the commitment tree and have not been used by the SDK yet
export interface GetNotesOpts {
  includeUncommitted?: boolean;
  ignoreOptimisticNFs?: boolean;
}

export class NocturneDB {
  // store the following mappings:
  //  merkleIndex => Note
  //  merkleIndex => totalEntityIndex
  //  asset => merkleIndex[]
  //  nullifier => merkleIndex
  public kv: KVStore;
  protected mutex: Mutex;

  constructor(kv: KVStore) {
    this.kv = kv;
    this.mutex = new Mutex();
  }

  static formatIndexKey(merkleIndex: number): string {
    return `${NOTES_BY_INDEX_PREFIX}-${numberToStringPadded(
      merkleIndex,
      MAX_MERKLE_INDEX_DIGITS
    )}`;
  }

  static formatAssetKey(asset: Asset): string {
    return `${NOTES_BY_ASSET_PREFIX}-${
      asset.assetType
    }-${ethers.utils.getAddress(asset.assetAddr)}-${asset.id.toString()}`;
  }

  static formatNullifierKey(nullifier: bigint): string {
    return `${NOTES_BY_NULLIFIER_PREFIX}-${nullifier.toString()}`;
  }

  static formatMerkleIndexToTotalEntityIndexKey(merkleIndex: number): string {
    return `${MERKLE_INDEX_TIMESTAMP_PREFIX}-${numberToStringPadded(
      merkleIndex,
      MAX_MERKLE_INDEX_DIGITS
    )}`;
  }

  static formatOptimisticNFRecordKey(merkleIndex: number): string {
    return `${OPTIMISTIC_NF_RECORD_PREFIX}-${numberToStringPadded(
      merkleIndex,
      MAX_MERKLE_INDEX_DIGITS
    )}`;
  }

  static formatOpHistoryRecordKey(digest: bigint): string {
    return `${OP_DIGEST_PREFIX}${digest.toString()}`;
  }

  static parseMerkleIndexFromOptimisticNFRecordKey(key: string): number {
    return parseInt(key.split("-")[1]);
  }

  static parseIndexKey(key: string): number {
    return parseInt(key.split("-")[1]);
  }

  static parseAssetKey(key: string): Asset {
    const [_, assetType, assetAddr, id] = key.split("-");
    return {
      assetType: AssetTrait.parseAssetType(assetType),
      assetAddr,
      id: BigInt(id),
    };
  }

  protected async _getHistoryRecord(
    digest: bigint
  ): Promise<OpHistoryRecord | undefined> {
    const key = NocturneDB.formatOpHistoryRecordKey(digest);
    const value = await this.kv.getString(key);
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(value);
  }

  protected async _setHistoryRecord(
    digest: bigint,
    record: OpHistoryRecord
  ): Promise<void> {
    const key = NocturneDB.formatOpHistoryRecordKey(digest);
    const value = JSON.stringify(record);
    await this.kv.putString(key, value);
  }

  protected async getHistoryArray(): Promise<bigint[]> {
    const value = await this.kv.getString(OP_HISTORY_KEY);
    if (value === undefined) {
      return [];
    }

    return JSON.parse(value);
  }

  protected async setHistoryArray(history: bigint[]): Promise<void> {
    const value = JSON.stringify(history);
    await this.kv.putString(OP_HISTORY_KEY, value);
  }

  async getHistory(includePending?: boolean): Promise<OpHistoryRecord[]> {
    return await this.mutex.runExclusive(async () => {
      const history = await this.getHistoryArray();
      const records = await Promise.all(
        history.map((digest) => this._getHistoryRecord(digest))
      );

      // if any record is missing, something bad happened
      if (records.some((r) => r === undefined)) {
        throw new Error("record not found");
      }

      if (!includePending) {
        return records.filter(
          (r) => r?.status && isTerminalOpStatus(r.status)
        ) as OpHistoryRecord[];
      }

      return records as OpHistoryRecord[];
    });
  }

  async getHistoryRecord(digest: bigint): Promise<OpHistoryRecord | undefined> {
    return await this.mutex.runExclusive(
      async () => await this._getHistoryRecord(digest)
    );
  }

  async setStatusForOp(
    opDigest: bigint,
    status: OperationStatus
  ): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const record = await this._getHistoryRecord(opDigest);
      if (record === undefined) {
        throw new Error("record not found");
      }

      record.status = status;
      record.lastModified = Date.now();

      await this._setHistoryRecord(opDigest, record);

      // remove the corresponding optimistic nf records if op failed
      if (isFailedOpStatus(status)) {
        await this.removeOptimisticNFRecords(record.spentNoteMerkleIndices);
      }
    });
  }

  async addOpToHistory(
    op: PreSignOperation | SignedOperation,
    metadata: OperationMetadata,
    status?: OperationStatus
  ): Promise<void> {
    const digest = OperationTrait.computeDigest(op);
    const pairs: [number, bigint][] = getMerkleIndicesAndNfsFromOp(op).map(
      ({ merkleIndex, nullifier }) => [Number(merkleIndex), nullifier]
    );
    const [spentNoteMerkleIndices] = unzip(pairs);

    const expirationDate = Date.now() + OPTIMISTIC_RECORD_TTL;
    const optimisticNfKvs = pairs.map(([merkleIndex, nullifier]) =>
      NocturneDB.makeOptimisticNFRecordKV(merkleIndex, {
        nullifier,
        expirationDate,
      })
    );

    await this.mutex.runExclusive(async () => {
      const now = Date.now();
      const record = {
        digest,
        metadata,
        status,
        spentNoteMerkleIndices,
        createdAt: now,
        lastModified: now,
      };

      await this._setHistoryRecord(record.digest, record);

      const history = await this.getHistoryArray();
      history.push(record.digest);
      await this.setHistoryArray(history);

      await this.kv.putMany(optimisticNfKvs);
    });
  }

  async removeOpFromHistory(
    digest: bigint,
    removeOptimisticNFs?: boolean
  ): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const history = await this.getHistoryArray();

      const index = history.indexOf(digest);
      if (index !== -1) {
        await this.setHistoryArray(history);
      } else {
        console.warn("tried to remove op from history that was not in history");
      }

      if (removeOptimisticNFs) {
        const spentIndices =
          (await this._getHistoryRecord(digest))?.spentNoteMerkleIndices ?? [];
        await this.removeOptimisticNFRecords(spentIndices);
      }

      await this.kv.remove(NocturneDB.formatOpHistoryRecordKey(digest));
    });
  }

  async pruneOptimisticNFs(): Promise<void> {
    const optimsiticNfRecords = await this.getAllOptimisticNFRecords();
    const keysToRemove = [...optimsiticNfRecords.entries()].flatMap(
      ([merkleIndex, record]) => {
        if (Date.now() > record.expirationDate) {
          return [NocturneDB.formatOptimisticNFRecordKey(merkleIndex)];
        }

        return [];
      }
    );

    await this.kv.removeMany(keysToRemove);
  }

  async getOptimisticNFRecord(
    merkleIndex: number
  ): Promise<OptimisticNFRecord | undefined> {
    const key = NocturneDB.formatOptimisticNFRecordKey(merkleIndex);
    const value = await this.kv.getString(key);

    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(value);
  }

  async getAllOptimisticNFRecords(): Promise<Map<number, OptimisticNFRecord>> {
    const map = new Map<number, OptimisticNFRecord>();
    const kvs = await this.kv.iterPrefix(OPTIMISTIC_NF_RECORD_PREFIX);
    for await (const [key, value] of kvs) {
      const merkleIndex =
        NocturneDB.parseMerkleIndexFromOptimisticNFRecordKey(key);
      const record = JSON.parse(value);
      map.set(merkleIndex, record);
    }

    return map;
  }

  async removeOptimisticNFRecords(merkleIndices: number[]): Promise<void> {
    const keys = merkleIndices.map(NocturneDB.formatOptimisticNFRecordKey);
    await this.kv.removeMany(keys);
  }

  async storeNotes(
    notesWithTotalEntityIndices: WithTotalEntityIndex<IncludedNoteWithNullifier>[]
  ): Promise<void> {
    const notes = notesWithTotalEntityIndices.map(({ inner }) => inner);
    // make note KVs
    const noteKVs: KV[] = notes.map(({ nullifier, ...note }) =>
      NocturneDB.makeNoteKV(note.merkleIndex, note)
    );

    // make the nullifier => merkleIndex KV pairs
    const nullifierKVs: KV[] = notes.map(({ merkleIndex, nullifier }) =>
      NocturneDB.makeNullifierKV(merkleIndex, nullifier)
    );

    // get the updated asset => merkleIndex[] KV pairs
    const assetKVs = await this.getUpdatedAssetKVsWithNotesAdded(notes);

    const merkleIndexToTotalEntityIndexKVs = notesWithTotalEntityIndices.map(
      ({ inner, totalEntityIndex }) =>
        NocturneDB.makeMerkleIndexToTotalEntityIndexKV(
          inner.merkleIndex,
          totalEntityIndex
        )
    );

    // write them all into the KV store
    await this.kv.putMany([
      ...noteKVs,
      ...nullifierKVs,
      ...assetKVs,
      ...merkleIndexToTotalEntityIndexKVs,
    ]);
  }

  // returns the merkle indices of the notes that were nullified
  async nullifyNotes(nullifiers: bigint[]): Promise<number[]> {
    // delete nullifier => merkleIndex KV pairs
    const nfKeys = nullifiers.map((nullifier) =>
      NocturneDB.formatNullifierKey(nullifier)
    );
    const kvs = await this.kv.getMany(nfKeys);
    await this.kv.removeMany([...nfKeys]);

    // get the notes we're nullifying
    const indices = kvs.map(([_nfKey, stringifiedIdx]) =>
      parseInt(stringifiedIdx)
    );
    const notes = await this.getNotesByMerkleIndices(indices);

    // get the updated asset => merkleIndex[] KV pairs
    // for each note, remove the note's merkleIndex from its asset's index keys
    const assetKVs = await this.getUpdatedAssetKVsWithNotesRemoved(notes);

    // write the new commitment KV pairs and the new asset => merkleIndex[] KV pairs to the KV store
    await this.kv.putMany(assetKVs);

    // remove any optimistic nf records for the nullified notes
    await this.removeOptimisticNFRecords(indices);

    return indices;
  }

  /**
   * Get all *committed* notes for an asset
   *
   * @param asset the asset to get notes for
   * @param opts optional options. See `GetNotesOpts` for more details.
   * @returns notes an array of notes for the asset. The array has no guaranteed order.
   */
  async getNotesForAsset(
    asset: Asset,
    opts?: GetNotesOpts
  ): Promise<IncludedNote[]> {
    const indices = await this.getMerkleIndicesForAsset(asset);
    const notes = await this.getNotesByMerkleIndices(indices);
    return this.filterNotesByOpts(notes, opts);
  }

  private async filterNotesByOpts(
    notes: IncludedNote[],
    opts?: GetNotesOpts
  ): Promise<IncludedNote[]> {
    if (!opts?.includeUncommitted) {
      const latestCommittedMerkleIndex =
        await this.latestCommittedMerkleIndex();
      if (latestCommittedMerkleIndex === undefined) {
        return [];
      }

      notes = notes.filter(
        (note) => note.merkleIndex <= latestCommittedMerkleIndex
      );
    }

    if (!opts?.ignoreOptimisticNFs) {
      const hasOptimisticNF = await Promise.all(
        notes.map(
          async (note) => !(await this.getOptimisticNFRecord(note.merkleIndex))
        )
      );
      notes = notes.filter((_, i) => hasOptimisticNF[i]);
    }

    return notes;
  }

  /**
   * Get TotalEntityIndex at which an owned note with merkleIndex `merkleIndex` was inserted into the tree (not necessarily committed)
   *
   * @param merkleIndex the merkleIndex to get the TotalEntityIndex for
   * @returns the totalEntityIndex in unix millis at which the merkleIndex was inserted into the tree,
   *          or undefined if the corresponding note is nullified or not owned
   */
  async getTotalEntityIndexForMerkleIndex(
    merkleIndex: number
  ): Promise<bigint | undefined> {
    const totalEntityIndexKey =
      NocturneDB.formatMerkleIndexToTotalEntityIndexKey(merkleIndex);
    return await this.kv.getBigInt(totalEntityIndexKey);
  }

  // return the totalEntityndex that the DB has been synced to
  // this is more/less a "version" number
  async currentTotalEntityIndex(): Promise<TotalEntityIndex | undefined> {
    return await this.kv.getBigInt(CURRENT_TOTAL_ENTITY_INDEX_KEY);
  }

  // update `currentTotallEntityIndex()`.
  async setCurrentTotalEntityIndex(
    totalEntityIndex: TotalEntityIndex
  ): Promise<void> {
    await this.kv.putBigInt(CURRENT_TOTAL_ENTITY_INDEX_KEY, totalEntityIndex);
  }

  // index of the last note synced (can be ahead of committed)
  async latestSyncedMerkleIndex(): Promise<number | undefined> {
    return await this.kv.getNumber(LAST_SYNCED_MERKLE_INDEX_KEY);
  }

  // update `latestSyncedMerkleIndex()`
  async setlatestSyncedMerkleIndex(index: number): Promise<void> {
    await this.kv.putNumber(LAST_SYNCED_MERKLE_INDEX_KEY, index);
  }

  // index of the last note (dummy or not) to be committed
  async latestCommittedMerkleIndex(): Promise<number | undefined> {
    return await this.kv.getNumber(LAST_COMMITTED_MERKLE_INDEX_KEY);
  }

  // update `latestCommittedMerkleIndex()`
  async setlatestCommittedMerkleIndex(index: number): Promise<void> {
    await this.kv.putNumber(LAST_COMMITTED_MERKLE_INDEX_KEY, index);
  }

  // applies a single state diff to the DB
  // returns the merkle indices of the notes that were nullified
  async applyStateDiff(diff: StateDiff): Promise<number[]> {
    const {
      notesAndCommitments,
      nullifiers,
      latestNewlySyncedMerkleIndex,
      latestCommittedMerkleIndex,
      totalEntityIndex,
    } = diff;

    // NOTE: order matters here - some `notesAndCommitments` may be nullified in the same state diff
    const notesToStore = notesAndCommitments.filter(
      ({ inner }) =>
        !NoteTrait.isCommitment(inner) &&
        (inner as IncludedNoteWithNullifier).value > 0n
    ) as WithTotalEntityIndex<IncludedNoteWithNullifier>[];

    // TODO: make this all one write
    await this.storeNotes(notesToStore);

    const nfIndices = await this.nullifyNotes(nullifiers);

    if (latestNewlySyncedMerkleIndex) {
      await this.setlatestSyncedMerkleIndex(latestNewlySyncedMerkleIndex);
    }
    if (latestCommittedMerkleIndex) {
      await this.setlatestCommittedMerkleIndex(latestCommittedMerkleIndex);
    }

    await this.setCurrentTotalEntityIndex(totalEntityIndex);

    return nfIndices;
  }

  /**
   * Get total value of all notes for a given asset
   *
   * @param asset the asset to get balance for
   * @param opts optional options. See `GetNotesOpts` for more details.
   * @returns total value of all notes for the asset summed up
   */
  async getBalanceForAsset(asset: Asset, opts?: GetNotesOpts): Promise<bigint> {
    const notes = await this.getNotesForAsset(asset, opts);
    return notes.reduce((a, b) => a + b.value, 0n);
  }

  /**
   * Get all notes in the KV store
   *
   * @param opts optional options. See `GetNotesOpts` for more details.
   * @returns allNotes a map of all notes in the KV store. keys are the `NoteAssetKey` for an asset,
   *          and values are an array of `IncludedNote`s for that asset. The array has no guaranteed order.
   */
  async getAllNotes(opts?: GetNotesOpts): Promise<AllNotes> {
    const allNotes = new Map<AssetKey, IncludedNote[]>();

    const iterPrefix = await this.kv.iterPrefix(NOTES_BY_ASSET_PREFIX);
    for await (const [assetKey, stringifiedIndices] of iterPrefix) {
      const indices: number[] = JSON.parse(stringifiedIndices);
      let notes = await this.getNotesByMerkleIndices(indices);
      notes = await this.filterNotesByOpts(notes, opts);

      const notesForAsset = allNotes.get(assetKey) ?? [];
      notesForAsset.push(...notes);

      if (notesForAsset.length !== 0) {
        allNotes.set(assetKey, notesForAsset);
      }
    }

    return allNotes;
  }

  private static makeNoteKV<N extends IncludedNote>(
    merkleIndex: number,
    note: N
  ): KV {
    return [NocturneDB.formatIndexKey(merkleIndex), JSON.stringify(note)];
  }

  private static makeNullifierKV(merkleIndex: number, nullifier: bigint): KV {
    return [NocturneDB.formatNullifierKey(nullifier), merkleIndex.toString()];
  }

  private static makeMerkleIndexToTotalEntityIndexKV(
    merkleIndex: number,
    totalEntityIndex: TotalEntityIndex
  ): KV {
    return [
      NocturneDB.formatMerkleIndexToTotalEntityIndexKey(merkleIndex),
      totalEntityIndex.toString(),
    ];
  }

  private static makeOptimisticNFRecordKV(
    merkleIndex: number,
    record: OptimisticNFRecord
  ): KV {
    const key = NocturneDB.formatOptimisticNFRecordKey(merkleIndex);
    const value = JSON.stringify(record);
    return [key, value];
  }

  private async getUpdatedAssetKVsWithNotesAdded<N extends IncludedNote>(
    notes: N[]
  ): Promise<KV[]> {
    const map = new Map<AssetKey, Set<number>>();
    for (const note of notes) {
      const assetKey = NocturneDB.formatAssetKey(note.asset);
      let indices = map.get(assetKey);
      if (!indices) {
        indices = new Set(await this.getMerkleIndicesForAsset(note.asset));
      }

      indices.add(note.merkleIndex);

      map.set(assetKey, indices);
    }

    return Array.from(map.entries()).map(([assetKey, indexKeys]) => [
      assetKey,
      JSON.stringify(Array.from(indexKeys)),
    ]);
  }

  private async getUpdatedAssetKVsWithNotesRemoved<N extends IncludedNote>(
    notes: N[]
  ): Promise<KV[]> {
    const map = new Map<AssetKey, Set<number>>();
    for (const note of notes) {
      const assetKey = NocturneDB.formatAssetKey(note.asset);
      let indices = map.get(assetKey);
      if (!indices) {
        indices = new Set(await this.getMerkleIndicesForAsset(note.asset));
      }

      indices.delete(note.merkleIndex);

      map.set(assetKey, indices);
    }

    return Array.from(map.entries()).map(([assetKey, indexKeys]) => [
      assetKey,
      JSON.stringify(Array.from(indexKeys)),
    ]);
  }

  private async getMerkleIndicesForAsset(asset: Asset): Promise<number[]> {
    const assetKey = NocturneDB.formatAssetKey(asset);
    const value = await this.kv.getString(assetKey);
    if (!value) {
      return [];
    }

    return JSON.parse(value);
  }

  private async getNotesByMerkleIndices(
    indices: number[]
  ): Promise<IncludedNote[]> {
    const idxKeys = indices.map((index) => NocturneDB.formatIndexKey(index));
    const kvs = await this.kv.getMany(idxKeys);
    return kvs.map(([_, value]) => {
      return JSON.parse(value) as IncludedNote;
    });
  }
}
