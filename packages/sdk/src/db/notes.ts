import {
  Asset,
  AssetTrait,
  IncludedNote,
  NoteTrait,
  IncludedNoteWithNullifier,
  IncludedNoteCommitment,
  Note,
} from "../primitives";
import { partition, numberToStringPadded } from "../utils";
import * as JSON from "bigint-json-serialization";
import { KV, KVStore } from "./kvStore";

const NOTES_BY_INDEX_PREFIX = "NOTES_BY_INDEX";
const NOTES_BY_ASSET_PREFIX = "NOTES_BY_ASSET";
const NOTES_BY_NULLIFIER_PREFIX = "NOTES_BY_NULLIFIER";

// ceil(log10(2^32))
const MAX_MERKLE_INDEX_DIGITS = 10;

export type AssetKey = string;
type AllNotes = Map<AssetKey, IncludedNote[]>;

export class NotesDB {
  // store the following mappings:
  //  merkleIndexKey => Note | bigint (note if usable, commitment if it's not. A note is usable IFF the user owns it and it hasn't been nullified yet).
  //  assetKey => merkleIndex[]
  //  nullifierKey => merkleIndex

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

  async storeNotesAndCommitments(
    notesAndCommitments: (IncludedNoteWithNullifier | IncludedNoteCommitment)[]
  ): Promise<void> {
    // partition the notes and commitments
    const [commitmentsPartition, notesPartition] = partition(
      notesAndCommitments,
      NoteTrait.isCommitment
    );
    const commitments = commitmentsPartition as IncludedNoteCommitment[];
    const notes = notesPartition as IncludedNoteWithNullifier[];

    // make note and commitment KVs
    const noteKVs: KV[] = notes.map((note) =>
      NotesDB.makeNoteKV(note.merkleIndex, note)
    );
    const commitmentKVs: KV[] = commitments.map(
      ({ merkleIndex, noteCommitment }) =>
        NotesDB.makeCommitmentKV(merkleIndex, noteCommitment)
    );

    // make the nullifier => merkleIndex KV pairs
    const nullifierKVs: KV[] = notes.map(({ merkleIndex, nullifier }) =>
      NotesDB.makeNullifierKV(merkleIndex, nullifier)
    );

    // get the updated asset => merkleIndex[] KV pairs
    const assetKVs = await this.getUpdatedAssetKVsWithNotesAdded(notes);

    // write them all into the KV store
    await this.kv.putMany([
      ...noteKVs,
      ...commitmentKVs,
      ...nullifierKVs,
      ...assetKVs,
    ]);
  }

  async nullifyNotes(nullifiers: bigint[]): Promise<void> {
    // delete nullifier => merkleIndex KV pairs
    const nfKeys = nullifiers.map((nullifier) =>
      NotesDB.formatNullifierKey(nullifier)
    );
    const kvs = await this.kv.getMany(nfKeys);
    await this.kv.removeMany([...nfKeys]);

    // get the notes we're nullifying
    const indices = kvs.map(([_nfKey, stringifiedIdx]) =>
      parseInt(stringifiedIdx)
    );
    const notes = await this.getNotesByMerkleIndices(indices);

    // make the merkleIndex => commitment KV pairs
    const commitmentKVs: KV[] = notes.map((note) =>
      NotesDB.makeCommitmentKV(note.merkleIndex, NoteTrait.toCommitment(note))
    );

    // get the updated asset => merkleIndex[] KV pairs
    // for each note, remove the note's merkleIndex from its asset's index keys
    const assetKVs = await this.getUpdatedAssetKVsWithNotesRemoved(notes);

    // write the new commitment KV pairs and the new asset => merkleIndex[] KV pairs to the KV store
    await this.kv.putMany([...commitmentKVs, ...assetKVs]);
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

  private static makeCommitmentKV(merkleIndex: number, commitment: bigint): KV {
    return [NotesDB.formatIndexKey(merkleIndex), commitment.toString()];
  }

  private static makeNoteKV<N extends Note>(merkleIndex: number, note: N): KV {
    return [
      NotesDB.formatIndexKey(merkleIndex),
      JSON.stringify(NoteTrait.toNote(note)),
    ];
  }

  private static makeNullifierKV(merkleIndex: number, nullifier: bigint): KV {
    return [NotesDB.formatNullifierKey(nullifier), merkleIndex.toString()];
  }

  private async getUpdatedAssetKVsWithNotesAdded<N extends IncludedNote>(
    notes: N[]
  ): Promise<KV[]> {
    const map = new Map<AssetKey, Set<number>>();
    for (const note of notes) {
      const assetKey = NotesDB.formatAssetKey(note.asset);
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
      const assetKey = NotesDB.formatAssetKey(note.asset);
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
    const assetKey = NotesDB.formatAssetKey(asset);
    const value = await this.kv.getString(assetKey);
    if (!value) {
      return [];
    }

    return JSON.parse(value);
  }

  private async getNotesByMerkleIndices(
    indices: number[]
  ): Promise<IncludedNote[]> {
    const idxKeys = indices.map((index) => NotesDB.formatIndexKey(index));
    const kvs = await this.kv.getMany(idxKeys);
    return kvs.map(([key, value]) => {
      const merkleIndex = NotesDB.parseIndexKey(key);
      const note = JSON.parse(value);
      return NoteTrait.toIncludedNote(note, merkleIndex);
    });
  }
}
