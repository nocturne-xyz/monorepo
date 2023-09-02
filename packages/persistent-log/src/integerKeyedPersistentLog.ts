import { ClosableAsyncIterator } from "@nocturne-xyz/core";
import {
  InsertionLogOptions,
  PersistentLog,
  RedisStreamId,
  ScanOptions,
} from "./persistentLog";
import IORedis from "ioredis";

export interface WithIndex<T> {
  index: number;
  inner: T;
}

export class IntegerKeyedPersistentLog<T> {
  inner: PersistentLog<T>;

  constructor(
    redis: IORedis,
    streamKey: string,
    options?: InsertionLogOptions
  ) {
    this.inner = new PersistentLog<T>(redis, streamKey, options);
  }

  async getTip(): Promise<number | undefined> {
    const tip = await this.inner.getTip();
    if (tip) {
      return indexFromRedisStreamId(tip);
    }
    return undefined;
  }

  async push(elems: WithIndex<T>[]): Promise<void> {
    await this.inner.push(
      elems.map(({ index, inner }) => ({
        inner,
        id: indexToRedisStreamId(index),
      }))
    );
  }

  scan(options?: ScanOptions): ClosableAsyncIterator<WithIndex<T>[]> {
    return this.inner.scan(options).map((batch) =>
      batch.map(({ id, inner }) => ({
        index: indexFromRedisStreamId(id),
        inner,
      }))
    );
  }
}

function indexToRedisStreamId(index: number): RedisStreamId {
  return `${index}-1`;
}

function indexFromRedisStreamId(id: RedisStreamId): number {
  const components = id.split("-");
  if (!components || components.length !== 2) {
    throw new Error("invalid id");
  }

  try {
    const res = parseInt(components[0]);
    if (res < 0 || isNaN(res)) {
      throw new Error("invalid id");
    }
    return res;
  } catch {
    throw new Error("invalid id");
  }
}
