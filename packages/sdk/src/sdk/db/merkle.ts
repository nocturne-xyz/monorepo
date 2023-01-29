import { KVStore } from "./kvStore";
import { numberToStringPadded } from "./utils";

export const LEAVES_PREFIX = "LEAVES";

export class MerkleDB {
  public kv: KVStore;

  constructor(kv: KVStore) {
    this.kv = kv;
  }

  /**
   * Format a leaf index into its corresponding key in the KV store
   * It produces a key of the form LEAVES_<index>
   *
   * @param index the index of the leaf
   * @returns key the corresponding key for the leaf
   */
  static leafKey(index: number): string {
    return LEAVES_PREFIX + "_" + numberToStringPadded(index, 64);
  }

  /**
   * Store a leaf
   *
   * @param index the index of the leaf
   * @param leaf the leaf to store
   * @returns true if successful, false otherwise
   */
  async storeLeaf(index: number, leaf: bigint): Promise<boolean> {
    return this.kv.putBigInt(MerkleDB.leafKey(index), leaf);
  }

  /**
   * Get a leaf
   *
   * @param index the index of the leaf
   * @returns the leaf if it exists, undefined otherwise
   */
  async getLeaf(index: number): Promise<bigint | undefined> {
    return this.kv.getBigInt(MerkleDB.leafKey(index));
  }

  private async *getLeavesIterator(): AsyncIterable<bigint> {
    const iterPrefix = await this.kv.iterPrefix(LEAVES_PREFIX);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const [_key, value] of iterPrefix) {
      yield BigInt(value);
    }
  }

  iterLeaves(): AsyncIterable<bigint> {
    return this.getLeavesIterator();
  }
}
