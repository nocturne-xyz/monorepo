import {
  Asset,
  AssetTrait,
  IncludedNote,
  NoteTrait,
  IncludedNoteWithNullifier,
  Note,
  OptimisticNFRecord,
  OptimisticOpDigestRecord,
} from "./primitives";
import { numberToStringPadded, zip } from "./utils";
import * as JSON from "bigint-json-serialization";
import { KV, KVStore } from "./store";
import { StateDiff, TotalEntityIndex, WithTotalEntityIndex } from "./sync";
import { ethers } from "ethers";

const NOTES_BY_INDEX_PREFIX = "NOTES_BY_INDEX";
const NOTES_BY_ASSET_PREFIX = "NOTES_BY_ASSET";
const NOTES_BY_NULLIFIER_PREFIX = "NOTES_BY_NULLIFIER";
const MERKLE_INDEX_TIMESTAMP_PREFIX = "MERKLE_INDEX_TIMESTAMP";
const OPTIMISTIC_NF_RECORD_PREFIX = "OPTIMISTIC_NF_RECORD";
const OPTIMISTIC_OP_DIGEST_RECORD_PREFIX = "OPTIMISTIC_OP_DIGEST_RECORD";
const NEXT_BLOCK_KEY = "NEXT_BLOCK";
const LAST_COMMITTED_MERKLE_INDEX_KEY = "LAST_MERKLE_INDEX";

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
  //  merkleIndexKey => Note
  //  assetKey => merkleIndex[]
  //  nullifierKey => merkleIndex
  //  merkleIndexTimestampKey => timestamp
  public kv: KVStore;

  constructor(kv: KVStore) {
    this.kv = kv;
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

  static formatTotalEntityIndexKey(merkleIndex: number): string {
    return `${MERKLE_INDEX_TIMESTAMP_PREFIX}-${numberToStringPadded(
      merkleIndex,
      MAX_MERKLE_INDEX_DIGITS
    )}`;
  }

  static formatOptimisticOpDigestRecordKey(opDigest: bigint): string {
    return `${OPTIMISTIC_OP_DIGEST_RECORD_PREFIX}-${opDigest.toString()}`;
  }

  static parseOpDigestFromOptimisticOpDigestRecordKey(key: string): bigint {
    return BigInt(key.split("-")[1]);
  }

  static formatOptimisticNFRecordKey(merkleIndex: number): string {
    return `${OPTIMISTIC_NF_RECORD_PREFIX}-${numberToStringPadded(
      merkleIndex,
      MAX_MERKLE_INDEX_DIGITS
    )}`;
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

  async storeOptimisticOpDigestRecords(
    opDigests: bigint[],
    records: OptimisticOpDigestRecord[]
  ): Promise<void> {
    const kvs = zip(opDigests, records).map(([opDigest, record]) =>
      NocturneDB.makeOptimisticOpDigestRecordKV(opDigest, record)
    );
    await this.kv.putMany(kvs);
  }

  async getAllOptimisticOpDigestRecords(): Promise<
    Map<bigint, OptimisticOpDigestRecord>
  > {
    const map = new Map<bigint, OptimisticOpDigestRecord>();
    const kvs = await this.kv.iterPrefix(OPTIMISTIC_OP_DIGEST_RECORD_PREFIX);
    for await (const [key, value] of kvs) {
      const opDigest =
        NocturneDB.parseOpDigestFromOptimisticOpDigestRecordKey(key);
      const record = JSON.parse(value);
      map.set(opDigest, record);
    }

    return map;
  }

  // Removes optimistic op digest and NF records for the given op digests
  async removeOptimisticRecordsForOpDigests(
    opDigests: bigint[]
  ): Promise<void> {
    const opDigestKeys = opDigests.map((digest) =>
      NocturneDB.formatOptimisticOpDigestRecordKey(digest)
    );
    const opDigestKvs = await this.kv.getMany(opDigestKeys);
    const opDigestRecords: OptimisticOpDigestRecord[] = opDigestKvs.map(
      ([_key, value]) => JSON.parse(value)
    );

    const merkleIndicesToRemove = opDigestRecords.flatMap(
      (record) => record.merkleIndices
    );

    const nfRecordKeys = merkleIndicesToRemove.map((index) =>
      NocturneDB.formatOptimisticNFRecordKey(index)
    );

    await this.kv.removeMany([...opDigestKeys, ...nfRecordKeys]);
  }

  async storeOptimisticRecords(
    opDigest: bigint,
    opDigestRecord: OptimisticOpDigestRecord,
    nfRecords: OptimisticNFRecord[]
  ): Promise<void> {
    const opDigestKv = NocturneDB.makeOptimisticOpDigestRecordKV(
      opDigest,
      opDigestRecord
    );
    const nfKvs = zip(opDigestRecord.merkleIndices, nfRecords).map(
      ([merkleIndex, nfRecord]) =>
        NocturneDB.makeOptimisticNFRecordKV(merkleIndex, nfRecord)
    );
    await this.kv.putMany([opDigestKv, ...nfKvs]);
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
    notesWithTotalEntityIndexs: WithTotalEntityIndex<IncludedNoteWithNullifier>[]
  ): Promise<void> {
    const notes = notesWithTotalEntityIndexs.map(({ inner }) => inner);
    // make note KVs
    const noteKVs: KV[] = notes.map((note) =>
      NocturneDB.makeNoteKV(note.merkleIndex, note)
    );

    // make the nullifier => merkleIndex KV pairs
    const nullifierKVs: KV[] = notes.map(({ merkleIndex, nullifier }) =>
      NocturneDB.makeNullifierKV(merkleIndex, nullifier)
    );

    // get the updated asset => merkleIndex[] KV pairs
    const assetKVs = await this.getUpdatedAssetKVsWithNotesAdded(notes);

    const timestampKVs = notesWithTotalEntityIndexs.map(
      ({ inner, totalEntityIndex }) =>
        NocturneDB.makeTotalEntityIndexKV(inner.merkleIndex, totalEntityIndex)
    );

    // write them all into the KV store
    await this.kv.putMany([
      ...noteKVs,
      ...nullifierKVs,
      ...assetKVs,
      ...timestampKVs,
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
      const lastCommittedMerkleIndex = await this.lastCommittedMerkleIndex();
      if (lastCommittedMerkleIndex === undefined) {
        return [];
      }

      notes = notes.filter(
        (note) => note.merkleIndex <= lastCommittedMerkleIndex
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
   * Get timestamp at which an owned note with merkleIndex `merkleIndex` was inserted into the tree (not necessarily committed)
   *
   * @param merkleIndex the merkleIndex to get the timestamp for
   * @returns timestamp the timestamp in unix millis at which the merkleIndex was inserted into the tree,
   *          or undefined if the corresponding note is nullified or not owned
   */
  async getTimestampForMerkleIndex(
    merkleIndex: number
  ): Promise<number | undefined> {
    const timestampKey = NocturneDB.formatTotalEntityIndexKey(merkleIndex);
    return await this.kv.getNumber(timestampKey);
  }

  /// return the totalLogIndex that the DB has been synced to
  // this is more/less a "version" number
  async totalEntityIndex(): Promise<TotalEntityIndex | undefined> {
    return await this.kv.getBigInt(NEXT_BLOCK_KEY);
  }

  // update `totlEntityIndex()`.
  async setTotalEntityIndex(totalEntityIndex: TotalEntityIndex): Promise<void> {
    await this.kv.putBigInt(NEXT_BLOCK_KEY, totalEntityIndex);
  }

  // index of the last note (dummy or not) to be committed
  async lastCommittedMerkleIndex(): Promise<number | undefined> {
    return await this.kv.getNumber(LAST_COMMITTED_MERKLE_INDEX_KEY);
  }

  // update `lastCommittedMerkleIndex()`
  async setLastCommittedMerkleIndex(index: number): Promise<void> {
    await this.kv.putNumber(LAST_COMMITTED_MERKLE_INDEX_KEY, index);
  }

  // applies a single state diff to the DB
  // returns the merkle indices of the notes that were nullified
  async applyStateDiff(diff: StateDiff): Promise<number[]> {
    const {
      notesAndCommitments,
      nullifiers,
      lastCommittedMerkleIndex,
      totalEntityIndex,
    } = diff;

    // TODO: make this all one write
    // NOTE: order matters here - some `notesAndCommitments` may be nullified in the same state diff
    await this.storeNotes(
      notesAndCommitments.filter(
        ({ inner }) => !NoteTrait.isCommitment(inner)
      ) as WithTotalEntityIndex<IncludedNoteWithNullifier>[]
    );
    const nfIndices = await this.nullifyNotes(nullifiers);

    if (lastCommittedMerkleIndex) {
      await this.setLastCommittedMerkleIndex(lastCommittedMerkleIndex);
    }

    await this.setTotalEntityIndex(totalEntityIndex);

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

  private static makeNoteKV<N extends Note>(merkleIndex: number, note: N): KV {
    return [
      NocturneDB.formatIndexKey(merkleIndex),
      JSON.stringify(NoteTrait.toNote(note)),
    ];
  }

  private static makeNullifierKV(merkleIndex: number, nullifier: bigint): KV {
    return [NocturneDB.formatNullifierKey(nullifier), merkleIndex.toString()];
  }

  private static makeTotalEntityIndexKV(
    merkleIndex: number,
    totalEntityIndex: TotalEntityIndex
  ): KV {
    return [
      NocturneDB.formatTotalEntityIndexKey(merkleIndex),
      totalEntityIndex.toString(),
    ];
  }

  private static makeOptimisticOpDigestRecordKV(
    opDigest: bigint,
    record: OptimisticOpDigestRecord
  ): KV {
    const key = NocturneDB.formatOptimisticOpDigestRecordKey(opDigest);
    const value = JSON.stringify(record);
    return [key, value];
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
    return kvs.map(([key, value]) => {
      const merkleIndex = NocturneDB.parseIndexKey(key);
      const note = JSON.parse(value) as Note;
      return NoteTrait.toIncludedNote(note, merkleIndex);
    });
  }
}
