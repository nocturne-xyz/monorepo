import { KV, KVStore, Thunk, thunk } from "@nocturne-xyz/core";
import { openDB, DBSchema, IDBPDatabase } from "idb/with-async-ittr";

interface IdbKvStoreSchema extends DBSchema {
  "kv-store": {
    key: string;
    value: string;
    indexes: { "by-key": string };
  };
}

export class IdbKvStore implements KVStore {
  db: Thunk<IDBPDatabase<IdbKvStoreSchema>>;
  constructor(dbName: string) {
    this.db = thunk(
      async () =>
        await openDB<IdbKvStoreSchema>(dbName, 1, {
          upgrade(db) {
            db.createObjectStore("kv-store");
          },
        })
    );
  }

  async getString(key: string): Promise<string | undefined> {
    const db = await this.db();
    return await db.get("kv-store", key);
  }

  async putString(key: string, value: string): Promise<boolean> {
    const db = await this.db();
    try {
      await db.put("kv-store", value, key);
    } catch (err) {
      console.error("Error in putString:", err);
      return false;
    }
    return true;
  }

  async remove(key: string): Promise<boolean> {
    const db = await this.db();
    try {
      await db.delete("kv-store", key);
    } catch (err) {
      console.error("Error in remove:", err);
      return false;
    }
    return true;
  }

  async containsKey(key: string): Promise<boolean> {
    const db = await this.db();
    return (await db.get("kv-store", key)) !== undefined;
  }

  async getNumber(key: string): Promise<number | undefined> {
    const db = await this.db();
    const value = await db.get("kv-store", key);
    return value === undefined ? undefined : parseInt(value);
  }

  async putNumber(key: string, value: number): Promise<boolean> {
    const db = await this.db();
    try {
      await db.put("kv-store", value.toString(), key);
    } catch (err) {
      console.error("Error in putNumber:", err);
      return false;
    }
    return true;
  }

  async getBigInt(key: string): Promise<bigint | undefined> {
    const db = await this.db();
    const value = await db.get("kv-store", key);
    return value === undefined ? undefined : BigInt(value);
  }

  async putBigInt(key: string, value: bigint): Promise<boolean> {
    const db = await this.db();
    try {
      await db.put("kv-store", value.toString(), key);
    } catch (err) {
      console.error("Error in putBigInt:", err);
      return false;
    }
    return true;
  }

  async iterRange(
    startKey: string,
    endKey: string
  ): Promise<AsyncIterable<KV>> {
    async function* generator(db: IDBPDatabase<IdbKvStoreSchema>) {
      const index = db.transaction("kv-store").store.index("by-key");
      const range = IDBKeyRange.bound(startKey, endKey, false, true);
      for await (const cursor of index.iterate(range)) {
        yield [cursor.key, cursor.value] as KV;
      }
    }

    return generator(await this.db());
  }

  async iterPrefix(prefix: string): Promise<AsyncIterable<KV>> {
    async function* generator(db: IDBPDatabase<IdbKvStoreSchema>) {
      const index = db.transaction("kv-store").store.index("by-key");
      const range = IDBKeyRange.lowerBound(prefix, true);
      for await (const cursor of index.iterate(range)) {
        if (!cursor.key.startsWith(prefix)) {
          break;
        }
        yield [cursor.key, cursor.value] as KV;
      }
    }

    return generator(await this.db());
  }

  async getMany(keys: string[]): Promise<KV[]> {
    const db = await this.db();
    const tx = db.transaction("kv-store", "readonly");
    return (
      await Promise.all(keys.map(async (key) => [key, await tx.store.get(key)]))
    ).filter(([_key, value]) => value !== undefined) as KV[];
  }

  async putMany(kvs: KV[]): Promise<boolean> {
    const db = await this.db();
    try {
      const tx = db.transaction("kv-store", "readwrite");
      await Promise.all(
        kvs.map(async ([key, value]) => await tx.store.put(value, key))
      );
    } catch (err) {
      console.error("Error in putMany:", err);
      return false;
    }
    return true;
  }

  async removeMany(keys: string[]): Promise<boolean> {
    const db = await this.db();
    try {
      const tx = db.transaction("kv-store", "readwrite");
      await Promise.all(keys.map(async (key) => await tx.store.delete(key)));
    } catch (err) {
      console.error("Error in removeMany:", err);
      return false;
    }
    return true;
  }

  async clear(): Promise<void> {
    const db = await this.db();
    await db.clear("kv-store");
  }

  async close(): Promise<void> {
    const db = await this.db();
    await db.close();
  }
}
