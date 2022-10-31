import { Asset, AssetHash } from "../../commonTypes";
import { IncludedNote, IncludedNoteStruct } from "../note";

export const NOTES_PREFIX = "NOTES_";

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

  static notesKey(asset: Asset): string {
    return NOTES_PREFIX + asset.hash();
  }

  /**
   * Store `SpendableNote` or `PendingNote` in it's appropriate place in DB.
   *
   * @param note either a `PendingNote` or `SpendableNote`
   */
  abstract storeNote(note: IncludedNote): Promise<boolean>;

  /**
   * Get mapping of all asset types to `IncludedNote[]`;
   *
   * @param asset asset address and id
   */
  abstract getAllNotes(asset: Asset): Map<AssetHash, IncludedNoteStruct[]>;
}

export * from "./lmdb";
