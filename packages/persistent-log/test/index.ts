import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import {
  PersistentLog,
  RedisStreamId,
  RedisStreamIdTrait,
  WithRedisStreamId,
} from "../src";
import { min, range, sleep } from "@nocturne-xyz/core";

function randomBigIntBounded(max: bigint): bigint {
  return BigInt(Math.floor(Math.random() * Number(max)));
}

const makeStreamIdWrapper = <T>() => {
  let currentId: RedisStreamId = "0-1";

  return (item: T): WithRedisStreamId<T> => {
    const res = {
      inner: item,
      id: currentId,
    };

    const [lhs, rhs] = RedisStreamIdTrait.toComponents(currentId);
    const newLhs = lhs + randomBigIntBounded(1000n);
    const newRhs =
      newLhs === lhs
        ? rhs + min(1n, randomBigIntBounded(1000n))
        : randomBigIntBounded(1000n);
    currentId = RedisStreamIdTrait.fromComponents(newLhs, newRhs);

    return res;
  };
};

describe("InsertionLog", () => {
  let redis: IORedis;

  before(async () => {
    const server = await RedisMemoryServer.create();
    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);
  });

  afterEach(async () => {
    await redis.flushall();
  });

  it("pushes and scans insertions from beginning", async () => {
    const log = new PersistentLog<string>(redis, "test");

    const withStreamId = makeStreamIdWrapper<string>();

    await log.push([
      withStreamId("I'm gonna be the king of pirates!"),
      withStreamId("This is my ninja way!"),
      withStreamId("Not giving up is my magic!"),
      withStreamId("Go beyond - Plus Ultra!"),
      withStreamId("To the top!"),
    ]);

    const result = (await log.scan().collect()).flat();

    expect(result.length).to.equal(5);
    expect(result[0].inner).to.equal("I'm gonna be the king of pirates!");
    expect(result[1].inner).to.equal("This is my ninja way!");
    expect(result[2].inner).to.equal("Not giving up is my magic!");
    expect(result[3].inner).to.equal("Go beyond - Plus Ultra!");
    expect(result[4].inner).to.equal("To the top!");
  });

  it("pushes and scans insertions from middle", async () => {
    const log = new PersistentLog<number>(redis, "test");
    const withStreamId = makeStreamIdWrapper<number>();

    const entries = range(0, 100)
      .map((_) => Math.random())
      .map(withStreamId);
    await log.push(entries);

    const middle = entries[49].id;
    const result = (await log.scan({ startId: middle }).collect()).flat();

    expect(result.length).to.equal(50);
    expect(result).to.eql(entries.slice(50));
  });

  it("pushes insertions in increments and scans over all", async () => {
    const log = new PersistentLog<number>(redis, "test");
    const withStreamId = makeStreamIdWrapper<number>();

    const secondBatch = range(0, 42).map((_) => Math.random());
    const firstBatch = range(0, 25).map((_) => Math.random());
    const thirdBatch = range(0, 69).map((_) => Math.random());

    await log.push(firstBatch.map(withStreamId));
    await log.push(secondBatch.map(withStreamId));
    await log.push(thirdBatch.map(withStreamId));

    const result = (await log.scan().collect()).flat();

    expect(result.map((entry) => entry.inner)).to.eql([
      ...firstBatch,
      ...secondBatch,
      ...thirdBatch,
    ]);
  });

  it("`getTip` returns `undefined` when empty", async () => {
    const log = new PersistentLog<number>(redis, "test");
    expect(await log.getTip()).to.be.undefined;
  });

  it("`getTip` returns correct result after pushing", async () => {
    const log = new PersistentLog<number>(redis, "test");
    const withStreamId = makeStreamIdWrapper<number>();

    {
      const entries = range(0, 100)
        .map((_) => Math.random())
        .map(withStreamId);
      await log.push(entries);
      expect(await log.getTip()).to.equal(entries[entries.length - 1].id);
    }

    {
      const entries = range(0, 100)
        .map((_) => Math.random())
        .map(withStreamId);
      await log.push(entries);
      expect(await log.getTip()).to.equal(entries[entries.length - 1].id);
    }
  });

  it("`scan` retruns past and future entries", async () => {
    const log = new PersistentLog<number>(redis, "test");
    const withStreamId = makeStreamIdWrapper<number>();

    // entries at start
    const allEntries = range(0, 100).map((_) => withStreamId(Math.random()));
    await log.push(allEntries);

    // iterator over all entries
    const scan = log.scan({ terminateOnEmpty: false, pollTimeout: 1000 });

    // entries inserted over time
    const writer = async function () {
      for (let i = 0; i < 10; i++) {
        const numEntries = Number(randomBigIntBounded(5n));

        const entries = range(0, numEntries).map((_) =>
          withStreamId(Math.random())
        );
        allEntries.push(...entries);
        await log.push(entries);

        const sleepTime = Number(randomBigIntBounded(1000n));
        await sleep(sleepTime);
      }

      await scan.close();
    };

    const [entries, _] = await Promise.all([scan.collect(), writer()]);
    expect(entries.flat()).to.eql(allEntries);
  });
});
