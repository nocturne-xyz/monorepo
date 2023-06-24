import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { PersistentLog } from "../src/persistentLog";
import {
  ClosableAsyncIterator,
  TotalEntityIndexTrait,
  WithTotalEntityIndex,
  range,
} from "@nocturne-xyz/sdk";

function randomBigIntBounded(max: bigint): bigint {
  return BigInt(Math.floor(Math.random() * Number(max)));
}

const makeTEIWrapper = <T>() => {
  let currentTotalEntityIndex = 0n;

  return (item: T): WithTotalEntityIndex<T> => {
    const res = {
      inner: item,
      totalEntityIndex: currentTotalEntityIndex,
    };

    let { blockNumber, txIdx, logIdx, eventIdx } =
      TotalEntityIndexTrait.toComponents(currentTotalEntityIndex);
    blockNumber += randomBigIntBounded(1000n);
    txIdx = randomBigIntBounded((1n << 32n) - 1n);
    logIdx = randomBigIntBounded((1n << 32n) - 1n);
    eventIdx = randomBigIntBounded((1n << 15n) - 1n);
    currentTotalEntityIndex = TotalEntityIndexTrait.fromComponents({
      blockNumber,
      txIdx,
      logIdx,
      eventIdx,
    });

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
    const log = new PersistentLog<string>(redis);

    const withTEI = makeTEIWrapper<string>();

    await log.push([
      withTEI("I'm gonna be the king of pirates!"),
      withTEI("This is my ninja way!"),
      withTEI("Not giving up is my magic!"),
      withTEI("Go beyond - Plus Ultra!"),
      withTEI("To the top!"),
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
    const log = new PersistentLog<number>(redis);
    const withTEI = makeTEIWrapper<number>();

    const entries = range(0, 100)
      .map((_) => Math.random())
      .map(withTEI);
    await log.push(entries);

    const middle = entries[50].totalEntityIndex;
    const result = (await log.scan(middle).collect()).flat();

    expect(result.length).to.equal(50);
    expect(result).to.eql(entries.slice(50));
  });

  it("pushes insertions in increments and scans over all", async () => {
    const log = new PersistentLog<number>(redis);
    const withTEI = makeTEIWrapper<number>();

    const secondBatch = range(0, 42).map((_) => Math.random());
    const firstBatch = range(0, 25).map((_) => Math.random());
    const thirdBatch = range(0, 69).map((_) => Math.random());

    await log.push(firstBatch.map(withTEI));
    await log.push(secondBatch.map(withTEI));
    await log.push(thirdBatch.map(withTEI));

    const result = (await log.scan().collect()).flat();

    expect(result.map((entry) => entry.inner)).to.eql([
      ...firstBatch,
      ...secondBatch,
      ...thirdBatch,
    ]);
  });

  it("returns latest TEI of `undefined` when empty", async () => {
    const log = new PersistentLog<number>(redis);
    expect(await log.getLatestTotalEntityIndex()).to.be.undefined;
  });

  it("correctly returns TEI after pushing", async () => {
    const log = new PersistentLog<number>(redis);
    const withTEI = makeTEIWrapper<number>();

    {
      const entries = range(0, 100)
        .map((_) => Math.random())
        .map(withTEI);
      await log.push(entries);
      expect(await log.getLatestTotalEntityIndex()).to.equal(
        entries[entries.length - 1].totalEntityIndex
      );
    }

    {
      const entries = range(0, 100)
        .map((_) => Math.random())
        .map(withTEI);
      await log.push(entries);
      expect(await log.getLatestTotalEntityIndex()).to.equal(
        entries[entries.length - 1].totalEntityIndex
      );
    }
  });

  it("can iterate over entries, insert them, and spit them back out in the same order on an iterator", async () => {
    const log = new PersistentLog<number>(redis);
    const withTEI = makeTEIWrapper<number>();

    const entries = range(0, 100).map((_) => withTEI(Math.random()));
    let closed = false;
    const generator = async function* () {
      let i = 0;
      while (!closed && i < entries.length) {
        yield [entries[i++]];
      }
    };

    const iterator = new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });

    const iterator2 = log.syncAndPipe(iterator);

    const result = (await iterator2.collect()).flat();

    expect(result).to.eql(entries);
    expect(await log.getLatestTotalEntityIndex()).to.equal(
      entries[entries.length - 1].totalEntityIndex
    );
  });
});
