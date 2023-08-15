import { KV, KVStore, zip } from "@nocturne-xyz/core";
import lmdb, { open, Database } from "lmdb";

interface LMDBKvStoreOpts {
  path?: string;
}

export class LMDBKVStore implements KVStore {
  private db: Database;

  constructor(opts?: LMDBKvStoreOpts) {
    this.db = open({ path: opts?.path ?? "./db" });
  }

  async getString(key: string): Promise<string | undefined> {
    return this.db.get(key);
  }

  async putString(key: string, value: string): Promise<boolean> {
    return this.db.put(key, value);
  }

  async remove(key: string): Promise<boolean> {
    return this.db.remove(key);
  }

  async containsKey(key: string): Promise<boolean> {
    return this.db.get(key) !== undefined;
  }

  async getNumber(key: string): Promise<number | undefined> {
    const value = await this.db.get(key);
    return value ? Number(value) : undefined;
  }

  async putNumber(key: string, value: number): Promise<boolean> {
    return this.db.put(key, value);
  }

  async getBigInt(key: string): Promise<bigint | undefined> {
    const value = await this.db.get(key);
    return value ? BigInt(value) : undefined;
  }

  async putBigInt(key: string, value: bigint): Promise<boolean> {
    await this.db.put(key, String(value)); // cast to string since lmdb native number put only allows 64 bits
    return true;
  }

  async iterRange(
    startKey: string,
    endKey: string
  ): Promise<AsyncIterable<KV>> {
    const lmdbIter = this.db.getRange({
      start: startKey,
      end: endKey,
      versions: false,
    });
    return toAsyncIterableKV(lmdbIter);
  }

  async iterPrefix(prefix: string): Promise<AsyncIterable<KV>> {
    const iter = this.db
      .getRange({ versions: false })
      .filter((kv) => kv.key.toString().startsWith(prefix));
    return toAsyncIterableKV(iter);
  }

  async putMany(kvs: KV[]): Promise<boolean> {
    const tx = this.db.transaction(() => {
      for (const [key, value] of kvs) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.db.put(key, value);
      }
    });
    await tx;
    return true;
  }

  async getMany(keys: string[]): Promise<KV[]> {
    const values = await this.db.getMany(keys);
    return zip(keys, values).filter(([k, v]) => k && v); // only returned defined vals
  }

  async removeMany(keys: string[]): Promise<boolean> {
    const tx = this.db.transaction(() => {
      for (const key of keys) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.db.remove(key);
      }
    });
    await tx;
    return true;
  }

  async clear(): Promise<void> {
    return this.db.clearAsync();
  }

  async close(): Promise<void> {
    return this.db.close();
  }
}

function toAsyncIterableKV(
  iterable: lmdb.RangeIterable<{
    key: lmdb.Key;
    value: any;
    version?: number | undefined;
  }>
): AsyncIterable<KV> {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const { key, value } of iterable) {
        yield [String(key), String(value)];
      }
    },
  };
}
