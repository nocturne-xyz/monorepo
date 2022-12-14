import { randomUUID } from "crypto";
import { Job } from "./types";
import IORedis from "ioredis";

export function jobDataToJob<T>(jobData: T): Job<T> {
  const id = randomUUID();
  return {
    id,
    data: jobData,
  };
}

export function getRedis(redis?: IORedis): IORedis {
  if (redis) {
    return redis;
  } else {
    const redisUrl = process.env.REDIS_URL ?? "localhost:6379";
    return new IORedis(redisUrl);
  }
}
