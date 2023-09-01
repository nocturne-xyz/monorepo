import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import {
  TestTreeInsertionSyncAdapter,
  randomInsertions,
} from "./testSyncAdapter";
import { range, sleep } from "@nocturne-xyz/core";
import {
  makeTestLogger,
  merkleIndexToRedisStreamId,
} from "@nocturne-xyz/offchain-utils";
import { InsertionWriter } from "../src";
import { ClosableAsyncIterator } from "@nocturne-xyz/core/src";
import { PersistentLog, Insertion } from "@nocturne-xyz/persistent-log";

describe("InsertionWriter", () => {
  it("replicates all insertions from merkle index 0 into one persistent log", async () => {
    const redis = await makeRedis();

    // setup a source of random insertions
    const expectedInsertions: Insertion[] = [];
    const source = randomInsertions().tap((batch) =>
      expectedInsertions.push(...batch)
    );

    // instantiate test adapter over source of random insertions
    const adapter = new TestTreeInsertionSyncAdapter(source);

    // instantiate insertion writer
    const logger = makeTestLogger(
      "testInsertionLog.ts",
      "replicates insertion log into one persistent log"
    );
    const writer = new InsertionWriter(adapter, redis, logger);

    // run for a while
    const handle = await writer.start();
    await sleep(20_000);

    // close source, should cause writer to terminate
    await handle.teardown();

    // check that insertion log is correct
    const insertionLog = writer.insertionLog;
    const actualInsertions = (await insertionLog.scan().collect()).flat();
    expect(actualInsertions).to.deep.equal(expectedInsertions);
  });

  it("skips insertions that are already in the log", async () => {
    const redis = await makeRedis();

    // setup a source of random insertions that we can repeat in multiple iterators
    const insertionBatches: Insertion[][] = [];
    const source = randomInsertions();
    const log = new PersistentLog<Insertion>(redis, "insertion-log");

    // push first 20 insertion batches into an array
    for (const _ of range(20)) {
      const batch = (await source.iter.next()).value as Insertion[];
      insertionBatches.push(batch);
    }

    // push first 10 into redis directly
    let merkleIndex = 0;
    for (const i of range(10)) {
      const batch = insertionBatches[i];
      await log.push(
        batch.map((insertion, i) => ({
          inner: insertion,
          id: `${merkleIndex + i}-1`,
        }))
      );
      merkleIndex += batch.length;
    }

    // make an adapter over a new iterator that repeats the first 20 insertions
    const adapter = new TestTreeInsertionSyncAdapter(
      ClosableAsyncIterator.fromArray(insertionBatches)
    );

    // instantiate insertion writer
    const logger = makeTestLogger(
      "testInsertionLog.ts",
      "skips insertions that are already in the log"
    );
    const writer = new InsertionWriter(adapter, redis, logger);

    // run until completion
    const handle = await writer.start();
    await handle.promise;

    // check that insertion log is correct
    const actualInsertions = (
      await log
        .scan()
        .map((elems) => elems.map(({ inner }) => inner))
        .collect()
    ).flat();
    expect(actualInsertions).to.deep.equal(insertionBatches.flat());
  });
});

// returns redises and a teardown function
async function makeRedis(): Promise<IORedis> {
  const server = await RedisMemoryServer.create();
  const host = await server.getHost();
  const port = await server.getPort();
  return new IORedis(port, host);
}
