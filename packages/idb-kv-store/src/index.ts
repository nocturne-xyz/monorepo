import { KV, KVStore, Thunk, thunk } from "@nocturne-xyz/core";
import { openDB, DBSchema, IDBPDatabase } from "idb/with-async-ittr";

interface IdbKvStoreSchema extends DBSchema {
  "kv-store": {
    key: string;
    value: string;
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

  // ! Note - this implementation is not "atomic" because indexedDB auto-closes transactions after the microtask
  // ! queue is empty, and there's nothing stopping the consumer of this iterator from performing async operations
  // ! before pulling the next value from the iterator.
  async iterRange(
    startKey: string,
    endKey: string
  ): Promise<AsyncIterable<KV>> {
    async function* generator(db: IDBPDatabase<IdbKvStoreSchema>) {
      let range = IDBKeyRange.bound(startKey, endKey, false, true);
      while (true) {
        const cursor = await db
          .transaction("kv-store", "readonly")
          .store.openCursor(range);
        if (!cursor) break;

        console.log(
          "[iter] cursor.key:",
          cursor.key,
          "cursor.value:",
          cursor.value
        );
        yield [cursor.key, cursor.value] as KV;

        range = IDBKeyRange.bound(cursor.key, endKey, true, true);
      }
    }

    return await generator(await this.db());
  }

  // ! Note - this implementation is not "atomic" because indexedDB auto-closes transactions after the microtask
  // ! queue is empty, and there's nothing stopping the consumer of this iterator from performing async operations
  // ! before pulling the next value from the iterator.
  async iterPrefix(prefix: string): Promise<AsyncIterable<KV>> {
    async function* generator(db: IDBPDatabase<IdbKvStoreSchema>) {
      let range = IDBKeyRange.lowerBound(prefix, false);
      while (true) {
        const cursor = await db
          .transaction("kv-store", "readonly")
          .store.openCursor(range);
        if (!cursor || !cursor.key.startsWith(prefix)) break;

        console.log(
          "[iterPrefix] cursor.key:",
          cursor.key,
          "cursor.value:",
          cursor.value
        );
        yield [cursor.key, cursor.value] as KV;

        range = IDBKeyRange.lowerBound(cursor.key, true);
      }
    }

    return await generator(await this.db());
  }

  async getMany(keys: string[]): Promise<KV[]> {
    const db = await this.db();
    const tx = db.transaction("kv-store", "readonly");
    const results = await Promise.all(
      keys.map(async (key) => [key, await tx.store.get(key)])
    );
    await tx.done;

    return results.filter(([_key, value]) => value !== undefined) as KV[];
  }

  async putMany(kvs: KV[]): Promise<boolean> {
    const db = await this.db();
    try {
      const tx = db.transaction("kv-store", "readwrite");
      await Promise.all([
        ...kvs.map(async ([key, value]) => await tx.store.put(value, key)),
        tx.done,
      ]);
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
      await Promise.all([
        ...keys.map(async (key) => await tx.store.delete(key)),
        tx.done,
      ]);
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
