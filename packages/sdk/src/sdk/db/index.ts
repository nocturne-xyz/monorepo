import { Asset, AssetHash } from "../../commonTypes";
import { IncludedNoteStruct } from "../note";

export const DEFAULT_DB_PATH = "db";
export const NOTES_PREFIX = "NOTES_";
export const LEAVES_PREFIX = "LEAVES_";

export abstract class FlaxDB {
  /**
   * Get arbitrary `value` for `key`.
   *
   * @param key key
   */
  abstract getKv(key: string): string | undefined;

  /**
   * Store arbitrary `value` for `key`. Enables additional storage needs like
   * storing last indexed block
   *
   * @param key key
   * @param value value
   */
  abstract putKv(key: string, value: string): Promise<boolean>;

  /**
   * Remove arbitrary `value` for `key`.
   *
   * @param key key
   */
  abstract removeKv(key: string): Promise<boolean>;

  /**
   * Format an `Asset` into a key for the notes db by prefixing with
   * `NOTES_PREFIX`.
   *
   * @param asset asset
   */
  static notesKey(asset: Asset): string {
    return NOTES_PREFIX + asset.hash();
  }

  /**
   * Store `IncludedNoteStruct` in it's appropriate place in DB.
   *
   * @param note an `IncludedNoteStruct`
   */
  abstract storeNote(note: IncludedNoteStruct): Promise<boolean>;

  /**
   * Remove `IncludedNoteStruct` from DB.
   *
   * @param note an `IncludedNoteStruct`
   */
  abstract removeNote(note: IncludedNoteStruct): Promise<boolean>;

  /**
   * Store several `IncludedNoteStruct` in db.
   *
   * @param notes array of `IncludedNoteStruct
   */
  async storeNotes(notes: IncludedNoteStruct[]): Promise<void> {
    for (const note of notes) {
      const success = this.storeNote(note);
      if (!success) {
        throw Error(`Failed to store note ${note}`);
      }
    }
  }

  /**
   * Get mapping of all asset types to `IncludedNoteStruct[]`;
   *
   * @returns mapping of all assets to their respective notes
   */
  abstract getAllNotes(): Map<AssetHash, IncludedNoteStruct[]>;

  /**
   * Clear entire database.
   */
  abstract clear(): void;

  /**
   * Close entire database.
   */
  abstract close(): Promise<void>;
}

export abstract class LocalMerkleDBExtension {
  static leafKey(index: number): string {
    return LEAVES_PREFIX + index;
  }

  abstract storeLeaf(index: number, leaf: bigint): Promise<boolean>;

  abstract getLeaf(index: number): bigint | undefined;
}

export * from "./lmdb";
