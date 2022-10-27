import { Asset, AssetHash } from "../commonTypes";
import { PendingNote, SpendableNote } from "./note";

export interface FlaxDB {
  /**
   * Store arbitrary `value` for `key`. Enables additional storage needs like
   * storing last indexed block
   *
   * @param key key
   * @param value value
   */
  putKv(key: string, value: string): void;

  /**
   * Get arbitrary `value` for `key`.
   *
   * @param key key
   */
  getKv(key: string): string;

  /**
   * Store `SpendableNote` or `PendingNote` in it's appropriate place in DB.
   *
   * @param note either a `PendingNote` or `SpendableNote`
   */
  storeNote(note: PendingNote | SpendableNote): void;

  /**
   * Get mapping of all asset types to `SpendableNote[]`;
   *
   * @param asset asset address and id
   */
  getAllSpendableNotes(asset: Asset): Map<AssetHash, SpendableNote[]>;

  /**
   * Get mapping of all asset types to `PendingNote[]`;
   *
   * @param asset asset address and id
   */
  getAllPendingNotes(asset: Asset): Map<AssetHash, PendingNote[]>;
}
