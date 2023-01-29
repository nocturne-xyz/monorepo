import BTree from "sorted-btree";
import { DumpableKVStore, KV } from "./kvStore";

export class InMemoryKVStore implements DumpableKVStore {
  private tree: BTree<string, string>;

  constructor() {
    this.tree = new BTree();
  }

  async getString(key: string): Promise<string | undefined> {
    return this.tree.get(key);
  }

  async putString(key: string, value: string): Promise<boolean> {
    this.tree.set(key, value);
    return true;
  }

  async remove(key: string): Promise<boolean> {
    this.tree.delete(key);
    return true;
  }

  async containsKey(key: string): Promise<boolean> {
    return this.tree.has(key);
  }

  async getNumber(key: string): Promise<number | undefined> {
    const value = await this.getString(key);
    if (value === undefined) {
      return undefined;
    }
    return Number(value);
  }

  async putNumber(key: string, value: number): Promise<boolean> {
    return this.putString(key, value.toString());
  }

  async getBigInt(key: string): Promise<bigint | undefined> {
    const value = await this.getString(key);
    if (value === undefined) {
      return undefined;
    }
    return BigInt(value);
  }

  async putBigInt(key: string, value: bigint): Promise<boolean> {
    return this.putString(key, value.toString());
  }

  private async *iterRangeUntil(
    startKey: string,
    cond: (kv: KV) => boolean
  ): AsyncIterable<KV> {
    let key = startKey;
    const kv: KV | undefined = this.tree.getPairOrNextHigher(key);
    if (kv === undefined || cond(kv)) {
      return;
    }

    key = kv[0];
    yield kv;

    while (true) {
      const kv: KV | undefined = this.tree.nextHigherPair(key);
      if (kv === undefined || cond(kv)) {
        return;
      }

      key = kv[0];
      yield kv;
    }
  }

  iterRange(startKey: string, endKey: string): Promise<AsyncIterable<KV>> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cond = ([key, _value]: KV) => this.tree._compare(key, endKey) >= 0;
    return new Promise((resolve) =>
      resolve(this.iterRangeUntil(startKey, cond))
    );
  }

  iterPrefix(prefix: string): Promise<AsyncIterable<KV>> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cond = ([key, _value]: KV) => !key.startsWith(prefix);
    return new Promise((resolve) => resolve(this.iterRangeUntil(prefix, cond)));
  }

  async putMany(kvs: KV[]): Promise<boolean> {
    for (const kv of kvs) {
      this.tree.set(kv[0], kv[1]);
    }
    return true;
  }

  async clear(): Promise<void> {
    this.tree = new BTree();
  }

  async close(): Promise<void> {}

  async dump(): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    for (const [key, value] of this.tree.entries()) {
      result[key] = value;
    }

    return result;
  }

  async loadFromDump(dump: Record<string, any>): Promise<void> {
    this.tree = new BTree();
    for (const key of Object.keys(dump)) {
      this.tree.set(key, dump[key]);
    }
  }
}
