import {
  ClosableAsyncIterator,
  IncludedNote,
  IncludedNoteCommitment,
} from "@nocturne-xyz/core";
import {
  InsertionLogOptions,
  PersistentLog,
  ScanOptions,
} from "./persistentLog";
import { RedisStreamId } from "./redisStreamId";
import IORedis from "ioredis";

export type Insertion = IncludedNote | IncludedNoteCommitment;

export interface TreeInsertionLogScanOptions
  extends Omit<ScanOptions, "startId" | "endId"> {
  startMerkleIndex?: number;
  endMerkleIndex?: number;
}

export class TreeInsertionLog {
  inner: PersistentLog<Insertion>;

  constructor(
    redis: IORedis,
    streamKey: string,
    options?: InsertionLogOptions
  ) {
    this.inner = new PersistentLog<Insertion>(redis, streamKey, options);
  }

  async getTip(): Promise<number | undefined> {
    const tip = await this.inner.getTip();
    if (tip) {
      return indexFromRedisStreamId(tip);
    }
    return undefined;
  }

  async push(insertions: Insertion[]): Promise<void> {
    await this.inner.push(
      insertions.map((insertion) => ({
        inner: insertion,
        id: indexToRedisStreamId(insertion.merkleIndex),
      }))
    );
  }

  scan(
    options?: TreeInsertionLogScanOptions
  ): ClosableAsyncIterator<Insertion[]> {
    const { startMerkleIndex, endMerkleIndex, ...rest } = options ?? {};
    const startId = startMerkleIndex
      ? indexToRedisStreamId(startMerkleIndex)
      : undefined;
    const endId = endMerkleIndex
      ? indexToRedisStreamId(endMerkleIndex)
      : undefined;
    const innerOptions: ScanOptions = { ...rest, startId, endId };
    return this.inner
      .scan(innerOptions)
      .map((batch) => batch.map(({ inner }) => inner));
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
