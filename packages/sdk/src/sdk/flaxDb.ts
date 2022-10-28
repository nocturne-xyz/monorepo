import { Asset, AssetHash } from "../commonTypes";
import { IncludedNote } from "./note";

export interface FlaxDB {
  /**
   * Get arbitrary `value` for `key`.
   *
   * @param key key
   */
  getKv(key: string): string | null;

  /**
   * Store arbitrary `value` for `key`. Enables additional storage needs like
   * storing last indexed block
   *
   * @param key key
   * @param value value
   */
  putKv(key: string, value: string): void;

  /**
   * Store `SpendableNote` or `PendingNote` in it's appropriate place in DB.
   *
   * @param note either a `PendingNote` or `SpendableNote`
   */
  storeNote(note: IncludedNote): void;

  /**
   * Get mapping of all asset types to `IncludedNote[]`;
   *
   * @param asset asset address and id
   */
  getAllNotes(asset: Asset): Map<AssetHash, IncludedNote[]>;
}
