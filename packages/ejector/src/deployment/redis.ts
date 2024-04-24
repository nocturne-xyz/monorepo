import { range, thunk } from "@nocturne-xyz/core";
import { Mutex } from "async-mutex";
import IORedis from "ioredis";
import RedisMemoryServer from "redis-memory-server";

export interface RedisHandle {
  getRedisServer: () => Promise<RedisMemoryServer>;
  getRedis: () => Promise<IORedis>;
  clearRedis: () => Promise<void>;
}

// HACK specify ports to use up-front to ensure they don't conflict with any of the actors
const redisPorts = range(6000, 6100);
const mutex = new Mutex();
export function makeRedisInstance(): RedisHandle {
  const redisThunk = thunk<[IORedis, RedisMemoryServer]>(async () => {
    const port = await mutex.runExclusive(() => redisPorts.pop());
    if (!port)
      throw new Error("ran out of available ports for redis instances");

    const server = await RedisMemoryServer.create({ instance: { port } });
    const host = await server.getHost();
    return [new IORedis(port, host), server];
  });

  return {
    getRedisServer: async () => (await redisThunk())[1],
    getRedis: async () => (await redisThunk())[0],
    clearRedis: async () => {
      const [redis, _] = await redisThunk();
      await redis.flushall();
    },
  };
}
