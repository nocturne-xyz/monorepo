export type KV = [string, string];

export abstract class KVStore {
  /**
   * Get the `value` assocaited with `key` as a string
   *
   * @param key key
   * @return value or undefined if not found
   */
  abstract getString(key: string): Promise<string | undefined>;

  /**
   * Set the value associated with `key` to the string `value`
   *
   * @param key key
   * @param value value
   * @return true if successful, false otherwise
   */
  abstract putString(key: string, value: string): Promise<boolean>;

  /**
   * Clear the value associated with `key`
   *
   * @param key key
   * @return true if successful, false otherwise
   */
  abstract remove(key: string): Promise<boolean>;

  /**
   * Check if a value exists for the key `key`
   * @param key key
   * @returns true if a value exists, false otherwise
   */
  abstract containsKey(key: string): Promise<boolean>;

  /**
   * Get the `value` assocaited with `key` as a number
   * If the corresponding value is not a number, this will throw an error
   *
   * @param key key
   * @return value or undefined if not found
   */
  abstract getNumber(key: string): Promise<number | undefined>;

  /**
   * Set the value associated with `key` to the number `value`
   *
   * @param key key
   * @param value number value
   * @return true if successful, false otherwise
   */
  abstract putNumber(key: string, value: number): Promise<boolean>;

  /**
   * Get the `value` assocaited with `key` as a bigint
   * If the corresponding value is not a bigint, this will throw an error
   *
   * @param key key
   * @return value or undefined if not found
   */
  abstract getBigInt(key: string): Promise<bigint | undefined>;

  /**
   * Set the value associated with `key` to the bigint `value`
   *
   * @param key key
   * @param value number value
   * @return true if successful, false otherwise
   */
  abstract putBigInt(key: string, value: bigint): Promise<boolean>;

  /**
   * return an iterator over all of the values in the KV store whose keys fall "lexicographically" from `startKey` to `endKey` (exclusive);
   *
   * note: this may be very slow depending on the underlying implementation.
   * note: the exact ordering key ordering is implementation-defined, but guaranteed to be consistent with JS's `>` for strings containing only printable characters
   *
   * @param startKey start key
   * @param endKey end key
   * @return an async iterator over existent key-value pairs in the range, sorted by key
   */
  abstract iterRange(
    startKey: string,
    endKey: string
  ): Promise<AsyncIterable<KV>>;

  /**
   * return an iterator over all of the values in the KV store whose keys start with `prefix`;
   *
   * note: this may be very slow depending on the underlying implementation.
   * note: the exact ordering key ordering is implementation-defined, but guaranteed to be consistent with JS's `>` for strings containing only printable characters
   *
   * @param prefix prefix
   * @return an async iterator over existent key-value pairs in the range, sorted by key
   */
  abstract iterPrefix(prefix: string): Promise<AsyncIterable<KV>>;

  /**
   * atomically get a batch of keys from the KV store
   * @param keys keys to get
   * @return key-value pairs corresponding to the keys that were found
   */
  abstract getMany(keys: string[]): Promise<KV[]>;

  /**
   * atomically put a batch of key-value pairs into the KV store
   * @param kvs key-value pairs to put
   * @return true if successful, false otherwise
   */
  abstract putMany(kvs: KV[]): Promise<boolean>;

  /**
   * atomically remove a batch of keys from the KV store
   * @param keys keys to remove
   * @return true if successful, false otherwise
   */
  abstract removeMany(keys: string[]): Promise<boolean>;

  /**
   * Clear entire KV store.
   */
  abstract clear(): Promise<void>;

  /**
   * Close entire KV store.
   */
  abstract close(): Promise<void>;
}

export abstract class DumpableKVStore extends KVStore {
  /**
   * Dump the entire KV store to a serializable javascript object
   *
   * @return JSON object
   */
  abstract dump(): Promise<Record<string, any>>;

  /**
   * Load the entire KV store from a serializable javascript object
   * This may overwrite any existing data in the KV store (implementation-dependent)
   */
  abstract loadFromDump(dump: Record<string, any>): Promise<void>;
}
