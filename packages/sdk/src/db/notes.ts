import { AllNotes, NoteAssetKey } from "../commonTypes";
import { Asset, AssetTrait } from "../asset";
import { IncludedNote, NoteTrait } from "../note";
import * as JSON from "bigint-json-serialization";
import { KV, KVStore } from "./kvStore";

const NOTES_PREFIX = "NOTES";

export class NotesDB {
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
  static formatNoteKey(note: IncludedNote): string {
    return (
      NotesDB.formatNoteAssetKey(note.asset) + "_" + NoteTrait.sha256(note)
    );
  }

  /**
   * Format an `Asset` into a key prefix for the all notes in the KV store for that asset
   * It produces a key of the form NOTES_<asset.address>_<asset.id>.
   *
   * @param asset asset for the note
   * @returns keyPrefix the key prefix for the asset the note is for
   */
  static formatNoteAssetKey(asset: Asset): NoteAssetKey {
    return (
      NOTES_PREFIX +
      "_" +
      asset.assetType +
      "_" +
      asset.assetAddr.toUpperCase() +
      "_" +
      asset.id
    );
  }

  /**
   * Parse a note asset key into an `Asset`. Expects a key of form NOTES_<address>_<id>
   * into the `Asset` the note is for
   *
   * @returns asset a
   * @throws Error if the key is not of the correct form
   */
  static parseAssetFromNoteAssetKey(key: NoteAssetKey): Asset {
    const arr = key.split("_");
    if (arr.length !== 4 || arr[0] !== NOTES_PREFIX) {
      throw Error(`Invalid note asset key: "${key}"`);
    }

    return {
      assetType: AssetTrait.parseAssetType(arr[1]),
      assetAddr: arr[2],
      id: BigInt(arr[3]),
    };
  }

  /**
   * Store a note
   *
   * @param note the note to store
   * @returns true if successful, false otherwise
   */
  async storeNote(note: IncludedNote): Promise<boolean> {
    const key = NotesDB.formatNoteKey(note);

    if (await this.kv.containsKey(key)) {
      return true;
    }

    const value = JSON.stringify(note);
    return await this.kv.putString(key, value);
  }

  /**
   * Get a note
   * @param key the key of the note to get
   * @returns note the note, or undefined if not found
   * @throws Error if the note is found but is not a valid `IncludedNote`
   */
  async removeNote(note: IncludedNote): Promise<boolean> {
    const key = NotesDB.formatNoteKey(note);
    return await this.kv.remove(key);
  }

  async storeNotes(notes: IncludedNote[]): Promise<boolean> {
    const kvs: KV[] = notes.map((note) => [
      NotesDB.formatNoteKey(note),
      JSON.stringify(note),
    ]);
    return await this.kv.putMany(kvs);
  }

  /**
   * Get all notes in the KV store
   *
   * @returns allNotes a map of all notes in the KV store. keys are the `NoteAssetKey` for an asset,
   *          and values are an array of `IncludedNote`s for that asset. The array has no guaranteed order.
   */
  async getAllNotes(): Promise<AllNotes> {
    const allNotes = new Map<NoteAssetKey, IncludedNote[]>();

    const iterPrefix = await this.kv.iterPrefix(NOTES_PREFIX);
    for await (const [, value] of iterPrefix) {
      const note = JSON.parse(value);
      const noteAssetKey = NotesDB.formatNoteAssetKey(note.asset);

      const notesForAsset = allNotes.get(noteAssetKey) ?? [];
      notesForAsset.push(note);

      allNotes.set(noteAssetKey, notesForAsset);
    }

    return allNotes;
  }

  /**
   * Get all notes for an asset
   *
   * @param asset the asset to get notes for
   * @returns notes an array of notes for the asset. The array has no guaranteed order.
   */
  async getNotesFor(asset: Asset): Promise<IncludedNote[]> {
    const noteAssetKey = NotesDB.formatNoteAssetKey(asset);

    const notes = [];
    const iterPrefix = await this.kv.iterPrefix(noteAssetKey);
    for await (const [, value] of iterPrefix) {
      const note = JSON.parse(value);
      notes.push(note);
    }

    return notes;
  }
}
