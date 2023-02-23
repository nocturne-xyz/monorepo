import {
  Asset,
  AssetTrait,
  IncludedNote,
  NoteTrait,
  IncludedNoteWithNullifier,
  IncludedNoteCommitment,
} from "@nocturne-xyz/primitives";
import * as JSON from "bigint-json-serialization";
import { KV, KVStore } from "./kvStore";
import { numberToStringPadded } from "..";

const NOTES_BY_INDEX_PREFIX = "NOTES_BY_INDEX";
const NOTES_BY_ASSET_PREFIX = "NOTES_BY_ASSET";
const NOTES_BY_NULLIFIER_PREFIX = "NOTES_BY_NULLIFIER";

// ceil(log10(2^32))
const MAX_MERKLE_INDEX_DIGITS = 10;

export type AssetKey = string;
type AllNotes = Map<AssetKey, IncludedNote[]>;

export class NotesDB {
  // store the following mappings:
  //  merkleIndex => Note | bigint (note if owned, commitment otherwise)
  //  asset => merkleIndex[]
  //  nullifier => merkleIndex
  public kv: KVStore;

  constructor(kv: KVStore) {
    this.kv = kv;
  }

  /**
   * Format an `IncludedNote` into its corresponding key in the KV store
   * It produces a key of the form NOTES_<note.asset>_<note.id>_<sha256(note)>
   *
   * @param note the note to format
   * @returns key the corresponding key for the note
   */
  static formatIndexKey(merkleIndex: number): string {
    return `${NOTES_BY_INDEX_PREFIX}-${numberToStringPadded(
      merkleIndex,
      MAX_MERKLE_INDEX_DIGITS
    )}`;
  }

  static parseIndexKey(key: string): number {
    return parseInt(key.split("-")[1]);
  }

  static formatAssetKey(asset: Asset): string {
    return `${NOTES_BY_ASSET_PREFIX}-${
      asset.assetType
    }-${asset.assetAddr.toUpperCase()}-${asset.id.toString()}`;
  }

  static parseAssetKey(key: string): Asset {
    const [_, assetType, assetAddr, id] = key.split("-");
    return {
      assetType: AssetTrait.parseAssetType(assetType),
      assetAddr,
      id: BigInt(id),
    };
  }

  static formatNullifierKey(nullifier: bigint): string {
    return `${NOTES_BY_NULLIFIER_PREFIX}-${nullifier.toString()}`;
  }

  async storeNotesAndCommitments(
    notesAndCommitments: (IncludedNoteWithNullifier | IncludedNoteCommitment)[]
  ): Promise<void> {
    // merkleIndex => Note
    const baseKVs: KV[] = notesAndCommitments.map((noteOrCommitment) => {
      if (NoteTrait.isNoteNotCommitment(noteOrCommitment)) {
        const includedNote = noteOrCommitment as IncludedNoteWithNullifier;
        const note = NoteTrait.toNote(includedNote);
        return [
          NotesDB.formatIndexKey(includedNote.merkleIndex),
          JSON.stringify(note),
        ];
      } else {
        const commitment = noteOrCommitment as IncludedNoteCommitment;
        return [
          NotesDB.formatIndexKey(commitment.merkleIndex),
          commitment.noteCommitment.toString(),
        ];
      }
    });

    const notes = notesAndCommitments.filter(
      NoteTrait.isNoteNotCommitment
    ) as IncludedNoteWithNullifier[];

    // nullifier => merkleIndex
    const nullifierKVs: KV[] = notes.map((note) => [
      NotesDB.formatNullifierKey(note.nullifier),
      NotesDB.formatIndexKey(note.merkleIndex),
    ]);

    // asset => merkleIndex[]
    const assetKVMap = new Map<AssetKey, string[]>();
    for (const note of notes) {
      const assetKey = NotesDB.formatAssetKey(note.asset);
      let indexKeys = assetKVMap.get(assetKey);
      if (!indexKeys) {
        indexKeys = await this.getMerkleIndexKeysForAsset(note.asset);
      }

      assetKVMap.set(assetKey, [
        ...indexKeys,
        NotesDB.formatIndexKey(note.merkleIndex),
      ]);
    }
    const assetKVs: KV[] = Array.from(assetKVMap.entries()).map(
      ([key, value]) => [key, JSON.stringify(value)]
    );

    await this.kv.putMany([...baseKVs, ...nullifierKVs, ...assetKVs]);
  }

  async removeNotesByNullifier(nullifiers: bigint[]): Promise<void> {
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
