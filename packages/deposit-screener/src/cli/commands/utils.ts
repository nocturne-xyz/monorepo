import IORedis from "ioredis";

export function getRedis(redis?: IORedis): IORedis {
  if (redis) {
    return redis;
  } else {
    const redisUrl = process.env.REDIS_URL ?? "localhost:6379";
    const redisPassword = process.env.REDIS_PASSWORD;

    return new IORedis(redisUrl, {
      password: redisPassword,
      maxRetriesPerRequest: null,
    });
  }
}
