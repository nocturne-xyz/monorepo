import IORedis from "ioredis";

export function getRedis(): IORedis {
  const redisUrl = process.env.REDIS_URL ?? "localhost:6379";
  const redisPassword = process.env.REDIS_PASSWORD;

  const redis = new IORedis(redisUrl, {
    password: redisPassword,
    maxRetriesPerRequest: null,
  });

  return redis;
}
