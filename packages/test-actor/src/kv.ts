import { InMemoryKVStore, KV, KVStore, thunk, Thunk } from "@nocturne-xyz/sdk";
import * as JSON from "bigint-json-serialization";
import fs from "fs";
import { Logger } from "winston";

const makeLoadKVfromDump = (kvPath: string, logger?: Logger) => async () => {
  const kv = new InMemoryKVStore();
  let maybeState = undefined;
  try {
    maybeState = JSON.parse(fs.readFileSync(kvPath, "utf8"));
  } catch (err) {
    logger && logger.error("Failed to load KV from disk", { err });
  }

  await kv.loadFromDump((maybeState as Record<string, any>) ?? {});
  return kv;
};

export class TestActorKVStore implements KVStore {
  private kv: Thunk<InMemoryKVStore>;
  private kvPath: string;
  private logger?: Logger;

  constructor(kvPath: string, logger?: Logger) {
    this.kvPath = kvPath;
    this.logger = logger;
    this.kv = thunk(makeLoadKVfromDump(this.kvPath, this.logger));
  }

  async flushToDisk(kv: InMemoryKVStore): Promise<boolean> {
    const state = await kv.dump();
    try {
      fs.writeFileSync(this.kvPath, JSON.stringify(state), {
        encoding: "utf8",
      });
      return true;
    } catch (err) {
      this.logger && this.logger.error("Failed to write KV to disk", { err });
      return false;
    }
  }

  async getString(key: string): Promise<string | undefined> {
    const kv = await this.kv();
    return kv.getString(key);
  }

  async putString(key: string, value: string): Promise<boolean> {
    const kv = await this.kv();
    await kv.putString(key, value);
    await this.flushToDisk(kv);
    return true;
  }

  async remove(key: string): Promise<boolean> {
    const kv = await this.kv();
    await kv.remove(key);
    await this.flushToDisk(kv);
    return true;
  }

  async containsKey(key: string): Promise<boolean> {
    const kv = await this.kv();
    return kv.containsKey(key);
  }

  async getNumber(key: string): Promise<number | undefined> {
    const kv = await this.kv();
    return kv.getNumber(key);
  }

  async putNumber(key: string, value: number): Promise<boolean> {
    const kv = await this.kv();
    await kv.putNumber(key, value);

    await this.flushToDisk(kv);
    return true;
  }

  async getBigInt(key: string): Promise<bigint | undefined> {
    const kv = await this.kv();
    return kv.getBigInt(key);
  }

  async putBigInt(key: string, value: bigint): Promise<boolean> {
    const kv = await this.kv();
    await kv.putBigInt(key, value);
    await this.flushToDisk(kv);
    return true;
  }

  async iterRange(
    startKey: string,
    endKey: string
  ): Promise<AsyncIterable<KV>> {
    const kv = await this.kv();
    return await kv.iterRange(startKey, endKey);
  }

  async iterPrefix(prefix: string): Promise<AsyncIterable<KV>> {
    const kv = await this.kv();
    return await kv.iterPrefix(prefix);
  }

  async putMany(kvs: KV[]): Promise<boolean> {
    const kv = await this.kv();
    await kv.putMany(kvs);
    await this.flushToDisk(kv);
    return true;
  }

  async getMany(keys: string[]): Promise<KV[]> {
    const kv = await this.kv();
    return await kv.getMany(keys);
  }

  async removeMany(keys: string[]): Promise<boolean> {
    const kv = await this.kv();
    await kv.removeMany(keys);
    await this.flushToDisk(kv);
    return true;
  }

  async clear(): Promise<void> {
    const emptyKV = new InMemoryKVStore();
    await this.flushToDisk(emptyKV);
    this.kv = thunk(makeLoadKVfromDump(this.kvPath, this.logger));
  }

  async close(): Promise<void> {
    return;
  }
}
