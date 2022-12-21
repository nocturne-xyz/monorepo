import IORedis from "ioredis";
import * as JSON from "bigint-json-serialization";

const BATCH_DB_NAME = "BATCH_DB";

export class BatcherDB<T> {
  redis: IORedis;

  constructor(redis: IORedis) {
    this.redis = redis;
  }

  async add(elem: T): Promise<boolean> {
    await this.redis.rpush(BATCH_DB_NAME, JSON.stringify(elem));
    return true;
  }

  async getBatch(count: number): Promise<T[] | undefined> {
    const stringifiedItems = await this.redis.lrange(BATCH_DB_NAME, 0, count);

    if (stringifiedItems.length == 0) {
      return undefined;
    }

    return stringifiedItems.map(JSON.parse) as T[];
  }

  async pop(count: number): Promise<T[] | undefined> {
    const stringifiedItems = await this.redis.lpop(BATCH_DB_NAME, count);

    if (!stringifiedItems) {
      return undefined;
    }

    return stringifiedItems.map(JSON.parse) as T[];
  }
}
