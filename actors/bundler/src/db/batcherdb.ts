import IORedis from "ioredis";
import * as JSON from "bigint-json-serialization";
import { RedisTransaction } from ".";
import { unixTimestampSeconds } from "../utils";

export type BufferSpeed = "FAST" | "MEDIUM" | "SLOW";
const WINDOW_START_KEY = "WINDOW_START";

export class BatcherDB<T> {
  prefix: BufferSpeed;
  redis: IORedis;

  constructor(prefix: BufferSpeed, redis: IORedis) {
    this.prefix = prefix;
    this.redis = redis;
  }

  async add(elem: T): Promise<boolean> {
    await this.redis.rpush(this.prefix, JSON.stringify(elem));
    await this.setWindowStart(unixTimestampSeconds());
    return true;
  }

  async size(): Promise<number> {
    return this.redis.llen(this.prefix);
  }

  async setWindowStart(windowStart: number): Promise<void> {
    await this.redis.set(WINDOW_START_KEY, windowStart.toString());
  }

  async getWindowStart(): Promise<number | undefined> {
    const windowStart = await this.redis.get(WINDOW_START_KEY);
    if (!windowStart) {
      return undefined;
    }
    return Number(windowStart);
  }

  async getBatch(count?: number, exact = false): Promise<T[] | undefined> {
    if (!count) {
      count = await this.size();
    }
    const stringifiedItems = await this.redis.lrange(this.prefix, 0, count);

    if (stringifiedItems.length == 0) {
      return undefined;
    }
    if (exact && stringifiedItems.length != count) {
      return undefined;
    }

    return stringifiedItems.map(JSON.parse) as T[];
  }

  async pop(count: number): Promise<T[] | undefined> {
    const stringifiedItems = await this.redis.lpop(this.prefix, count);

    if (!stringifiedItems) {
      return undefined;
    }

    return stringifiedItems.map(JSON.parse) as T[];
  }

  getAddTransaction(elem: T): RedisTransaction {
    return ["rpush", this.prefix, JSON.stringify(elem)];
  }

  getPopTransaction(count: number): RedisTransaction {
    return ["lpop", this.prefix, count.toString()];
  }
}
