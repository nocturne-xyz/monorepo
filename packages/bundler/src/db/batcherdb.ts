import IORedis from "ioredis";
import * as JSON from "bigint-json-serialization";

const BATCH_DB_NAME = "BATCH_DB";

export class BundlerBatcherDB<T> {
  redis: IORedis;
  readonly BATCH_SIZE: number = 8;

  constructor(redis: IORedis, batchSize?: number) {
    this.redis = redis;

    if (batchSize) {
      this.BATCH_SIZE = batchSize;
    }
  }

  async add(elem: T): Promise<boolean> {
    await this.redis.rpush(BATCH_DB_NAME, JSON.stringify(elem));
    return true;
  }

  async hasFullBatch(): Promise<boolean> {
    const batch = await this.getCurrentBatch();

    if (!batch) {
      return false;
    }

    return batch.length >= this.BATCH_SIZE;
  }

  async getCurrentBatch(): Promise<T[] | undefined> {
    const stringifiedItems = await this.redis.lrange(
      BATCH_DB_NAME,
      0,
      this.BATCH_SIZE
    );

    if (stringifiedItems.length == 0) {
      return undefined;
    }

    return stringifiedItems.map(JSON.parse) as T[];
  }

  async pop(count: number = this.BATCH_SIZE): Promise<T[] | undefined> {
    const stringifiedItems = await this.redis.lpop(BATCH_DB_NAME, count);

    if (!stringifiedItems) {
      return undefined;
    }

    return stringifiedItems.map(JSON.parse) as T[];
  }
}
