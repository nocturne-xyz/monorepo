import IORedis from "ioredis";
import * as JSON from "bigint-json-serialization";

export function parseRequestBody(body: any): any {
  return JSON.parse(JSON.stringify(body));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getRedis(redis?: IORedis): IORedis {
  if (redis) {
    return redis;
  } else {
    const redisUrl = process.env.REDIS_URL ?? "localhost:6379";
    const redisPassword = process.env.REDIS_PASSWORD;

    return new IORedis(redisUrl, {
      password: redisPassword,
    });
  }
}
