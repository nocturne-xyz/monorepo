import { StringifiedAssetStruct, AssetStruct } from "../../commonTypes";
import { IncludedNote } from "../note";

export const DEFAULT_DB_PATH = "db";
export const NOTES_PREFIX = "NOTES_";
export const LEAVES_PREFIX = "LEAVES_";

export abstract class NocturneDB {
  /**
   * Get arbitrary `value` for `key`.
   *
   * @param key key
   */
  abstract getKv(key: string): Promise<string | undefined>;

  /**
   * Store arbitrary `value` for `key`.
   *
   * @param key key
   * @param value value
   */
  abstract putKv(key: string, value: string): Promise<boolean>;

  /**
   * Get arbitrary number `value` for `key`.
   *
   * @param key key
   */
  async getNumberKv(key: string): Promise<number | undefined> {
    const stringVal = await this.getKv(key);

    if (!stringVal) {
      return undefined;
    }

    return parseInt(stringVal);
  }

  /**
   * Store arbitrary number `value` for `key`. Enables additional storage needs
   * like storing last indexed block.
   *
   * @param key key
   * @param value number value
   */
  putNumberKv(key: string, value: number): Promise<boolean> {
    return this.putKv(key, value.toString());
  }

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
  static formatNotesKey(asset: AssetStruct): string {
    return NOTES_PREFIX + asset.address + "_" + asset.id;
  }

  /**
   * Format an `Asset` into a key for the notes db by prefixing with
   * `NOTES_PREFIX`.
   *
   * @param asset asset
   */
  static parseNotesKey(key: string): AssetStruct {
    const arr = key.split("_");
    return {
      address: arr[1],
      id: BigInt(arr[2]),
    };
  }

  /**
   * Store `IncludedNote` in it's appropriate place in DB.
   *
   * @param note an `IncludedNote`
   */
  abstract storeNote(note: IncludedNote): Promise<boolean>;

  /**
   * Remove `IncludedNote` from DB.
   *
   * @param note an `IncludedNote`
   */
  abstract removeNote(note: IncludedNote): Promise<boolean>;

  /**
   * Store several `IncludedNote` in db.
   *
   * @param notes array of `IncludedNote
   */
  async storeNotes(notes: IncludedNote[]): Promise<void> {
    for (const note of notes) {
      const success = await this.storeNote(note);
      if (!success) {
        throw Error(`Failed to store note ${note}`);
      }
    }
  }

  /**
   * Get mapping of all asset types to `IncludedNote[]`;
   *
   * @returns mapping of all assets to their respective notes
   */
  abstract getAllNotes(): Promise<Map<StringifiedAssetStruct, IncludedNote[]>>;

  /**
   * Get mapping of all asset types to `IncludedNote[]`;
   *
   * @returns mapping of all assets to their respective notes
   */
  abstract getNotesFor(asset: AssetStruct): Promise<IncludedNote[]>;

  /**
   * Clear entire database.
   */
  abstract clear(): Promise<void>;

  /**
   * Close entire database.
   */
  abstract close(): Promise<void>;
}

export abstract class LocalMerkleDBExtension extends NocturneDB {
  static leafKey(index: number): string {
    return LEAVES_PREFIX + index;
  }

  abstract storeLeaf(index: number, leaf: bigint): Promise<boolean>;

  abstract getLeaf(index: number): Promise<bigint | undefined>;
}

export * from "./objectdb";
export { LocalObjectDB } from "./local";
