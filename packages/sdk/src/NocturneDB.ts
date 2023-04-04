import {
  Asset,
  AssetTrait,
  IncludedNote,
  NoteTrait,
  IncludedNoteWithNullifier,
  Note,
} from "./primitives";
import { numberToStringPadded } from "./utils";
import * as JSON from "bigint-json-serialization";
import { KV, KVStore } from "./store";
import { StateDiff } from "./sync";

const NOTES_BY_INDEX_PREFIX = "NOTES_BY_INDEX";
const NOTES_BY_ASSET_PREFIX = "NOTES_BY_ASSET";
const NOTES_BY_NULLIFIER_PREFIX = "NOTES_BY_NULLIFIER";
const NEXT_BLOCK_KEY = "NEXT_BLOCK";
const NEXT_MERKLE_INDEX_KEY = "NEXT_MERKLE_INDEX";
const DEFAULT_START_BLOCK = 0;

// ceil(log10(2^32))
const MAX_MERKLE_INDEX_DIGITS = 10;

export type AssetKey = string;
type AllNotes = Map<AssetKey, IncludedNote[]>;

export interface NocturneDBOpts {
  startBlock?: number;
}

export class NocturneDB {
  // store the following mappings:
  //  merkleIndexKey => Note
  //  assetKey => merkleIndex[]
  //  nullifierKey => merkleIndex
  public kv: KVStore;
  private startBlock: number;

  constructor(kv: KVStore, opts?: NocturneDBOpts) {
    this.kv = kv;
    this.startBlock = opts?.startBlock ?? DEFAULT_START_BLOCK;
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
    }-${asset.assetAddr.toUpperCase()}-${asset.id.toString()}`;
  }

  static formatNullifierKey(nullifier: bigint): string {
    return `${NOTES_BY_NULLIFIER_PREFIX}-${nullifier.toString()}`;
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

  async storeNotes(notes: IncludedNoteWithNullifier[]): Promise<void> {
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

    // write them all into the KV store
    await this.kv.putMany([...noteKVs, ...nullifierKVs, ...assetKVs]);
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

    return indices;
  }

  /**
   * Get all notes for an asset
   *
   * @param asset the asset to get notes for
   * @returns notes an array of notes for the asset. The array has no guaranteed order.
   */
  async getNotesForAsset(asset: Asset): Promise<IncludedNote[]> {
    const indices = await this.getMerkleIndicesForAsset(asset);

    return await this.getNotesByMerkleIndices(indices);
  }

  /// return the next block number the DB has not yet been synced to
  // this is more/less a "version" number
  // returns `this.startBlock` if it's undefined
  async nextBlock(): Promise<number> {
    return (await this.kv.getNumber(NEXT_BLOCK_KEY)) ?? this.startBlock;
  }

  // update `nextBlock()`.
  async setNextBlock(currentBlock: number): Promise<void> {
    await this.kv.putNumber(NEXT_BLOCK_KEY, currentBlock);
  }

  // index of the next note (dummy or not) to be committed
  async nextMerkleIndex(): Promise<number> {
    return (await this.kv.getNumber(NEXT_MERKLE_INDEX_KEY)) ?? 0;
  }

  // update `nextMerkleIndex()`
  async setNextMerkleIndex(index: number): Promise<void> {
    await this.kv.putNumber(NEXT_MERKLE_INDEX_KEY, index);
  }

  // applies a single state diff to the DB
  // returns the merkle indices of the notes that were nullified
  async applyStateDiff(diff: StateDiff): Promise<number[]> {
    const { notesAndCommitments, nullifiers, nextMerkleIndex, blockNumber } =
      diff;

    // TODO: make this all one write
    // NOTE: order matters here - some `notesAndCommitments` may be nullified in the same state diff
    await this.storeNotes(
      notesAndCommitments.filter(
        (noteOrCommitment) => !NoteTrait.isCommitment(noteOrCommitment)
      ) as IncludedNoteWithNullifier[]
    );
    const nfIndices = await this.nullifyNotes(nullifiers);
    await this.setNextMerkleIndex(nextMerkleIndex);
    await this.setNextBlock(blockNumber + 1);

    return nfIndices;
  }

  /**
   * Get total value for an asset
   *
   * @param asset the asset to get value for
   * @returns value of all notes for the asset summed up
   */
  async getBalanceForAsset(asset: Asset): Promise<bigint> {
    const notes = await this.getNotesForAsset(asset);
    return notes.reduce((a, b) => a + b.value, 0n);
  }

  /**
   * Get all notes in the KV store
   *
   * @returns allNotes a map of all notes in the KV store. keys are the `NoteAssetKey` for an asset,
   *          and values are an array of `IncludedNote`s for that asset. The array has no guaranteed order.
   */
  async getAllNotes(): Promise<AllNotes> {
    const allNotes = new Map<AssetKey, IncludedNote[]>();

    const iterPrefix = await this.kv.iterPrefix(NOTES_BY_ASSET_PREFIX);
    for await (const [assetKey, stringifiedIndices] of iterPrefix) {
      const indices: number[] = JSON.parse(stringifiedIndices);
      const notes = await this.getNotesByMerkleIndices(indices);

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
