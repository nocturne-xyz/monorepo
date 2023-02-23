import {
  Asset,
  AssetTrait,
  IncludedNote,
  NoteTrait,
  IncludedNoteWithNullifier,
  IncludedNoteCommitment,
  Note,
} from "@nocturne-xyz/primitives";
import * as JSON from "bigint-json-serialization";
import { KV, KVStore } from "./kvStore";
import { partition, numberToStringPadded } from "@nocturne-xyz/base-utils";

const NOTES_BY_INDEX_PREFIX = "NOTES_BY_INDEX";
const NOTES_BY_ASSET_PREFIX = "NOTES_BY_ASSET";
const NOTES_BY_NULLIFIER_PREFIX = "NOTES_BY_NULLIFIER";

// ceil(log10(2^32))
const MAX_MERKLE_INDEX_DIGITS = 10;

export type AssetKey = string;
type AllNotes = Map<AssetKey, IncludedNote[]>;

export class NotesDB {
  // store the following mappings:
  //  merkleIndexKey => Note | bigint (note if usable, commitment if it's not (i.e. it's been spent or it's not owned by the user)))
  //  assetKey => merkleIndexKey[]
  //  nullifierKey => merkleIndexKey
  //
  // where `merkleIndexKey`, `assetKey` and `nullifierKey` are as defined below by `formatIndexKey`, `formatAssetKey` and `formatNullifierKey` respectively
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
    const assetKVs = await this.getUpdatedAssetKVs(notes, (keyset, note) =>
      keyset.add(NotesDB.formatIndexKey(note.merkleIndex))
    );

    // write them all into the KV store
    await this.kv.putMany([
      ...noteKVs,
      ...commitmentKVs,
      ...nullifierKVs,
      ...assetKVs,
    ]);
  }

  async removeNotesByNullifiers(nullifiers: bigint[]): Promise<void> {
    const nfKeys = nullifiers.map((nullifier) =>
      NotesDB.formatNullifierKey(nullifier)
    );
    const kvs = await this.kv.getMany(nfKeys);
    const idxKeys = kvs.map(([_nfKey, idxKey]) => idxKey);
    await this.kv.removeMany([...nfKeys, ...idxKeys]);
  }

  /**
   * Get all notes for an asset
   *
   * @param asset the asset to get notes for
   * @returns notes an array of notes for the asset. The array has no guaranteed order.
   */
  async getNotesForAsset(asset: Asset): Promise<IncludedNote[]> {
    const indexKeys = await this.getMerkleIndexKeysForAsset(asset);

    return await this.getNotesByIndexKeys(indexKeys);
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
    for await (const [assetKey, stringifiedIndexKeys] of iterPrefix) {
      const indexKeys: string[] = JSON.parse(stringifiedIndexKeys);
      const notes = await this.getNotesByIndexKeys(indexKeys);

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
    return [
      NotesDB.formatNullifierKey(nullifier),
      NotesDB.formatIndexKey(merkleIndex),
    ];
  }

  private async getUpdatedAssetKVs<N extends IncludedNote>(
    notes: N[],
    update: (keyset: Set<string>, note: N) => void
  ): Promise<KV[]> {
    const map = new Map<AssetKey, Set<string>>();
    for (const note of notes) {
      const assetKey = NotesDB.formatAssetKey(note.asset);
      let indexKeys = map.get(assetKey);
      if (!indexKeys) {
        indexKeys = new Set(await this.getMerkleIndexKeysForAsset(note.asset));
      }

      update(indexKeys, note);

      map.set(assetKey, indexKeys);
    }

    return Array.from(map.entries()).map(([assetKey, indexKeys]) => [
      assetKey,
      JSON.stringify(Array.from(indexKeys)),
    ]);
  }

  private async getMerkleIndexKeysForAsset(asset: Asset): Promise<string[]> {
    const assetKey = NotesDB.formatAssetKey(asset);
    const value = await this.kv.getString(assetKey);
    if (!value) {
      return [];
    }

    return JSON.parse(value);
  }

  private async getNotesByIndexKeys(
    idxKeys: string[]
  ): Promise<IncludedNote[]> {
    const kvs = await this.kv.getMany(idxKeys);
    return kvs.map(([key, value]) => {
      const merkleIndex = NotesDB.parseIndexKey(key);
      const note = JSON.parse(value);
      return NoteTrait.toIncludedNote(note, merkleIndex);
    });
  }
}
