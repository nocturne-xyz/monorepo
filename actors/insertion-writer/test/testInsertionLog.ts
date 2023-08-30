import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import {
  TestTreeInsertionSyncAdapter,
  randomInsertions,
} from "./testSyncAdapter";
import { range, sleep, unzip } from "@nocturne-xyz/core";
import { makeTestLogger } from "@nocturne-xyz/offchain-utils";
import { InsertionWriter } from "../src";
import { Insertion } from "../src/sync/syncAdapter";

describe("TestTreeInsertionSyncAdapter", () => {
  it("replicates all insertions from merkle index 0 into one persistent log", async () => {
    const [redises, teardown] = await makeRedises(1);

    // setup a source of random insertions
    const expectedInsertions: Insertion[] = [];
    const source = randomInsertions().tap((insertion) =>
      expectedInsertions.push(...insertion)
    );

    // instantiate test adapter over source of random insertions
    const adapter = new TestTreeInsertionSyncAdapter(source);

    // instantiate insertion writer
    const logger = makeTestLogger(
      "testInsertionLog.ts",
      "replicates insertion log into one persistent log"
    );
    const writer = new InsertionWriter(adapter, redises[0], logger);

    // run for a while
    const handle = await writer.start();
    await sleep(50_000);

    // close source, should cause writer to terminate
    await source.close();
    await handle.promise;

    // check that insertion log is correct
    const insertionLog = writer.insertionLog;
    const actualInsertions = await insertionLog.scan().collect();
    expect(actualInsertions).to.deep.equal([expectedInsertions]);
    await teardown();
  });
});

// returns redises and a teardown function
async function makeRedises(
  numRedises: number
): Promise<[IORedis[], () => Promise<void>]> {
  const [redises, teardownFns] = unzip(
    await Promise.all(
      range(numRedises).map(async () => {
        const server = await RedisMemoryServer.create();
        const host = await server.getHost();
        const port = await server.getPort();
        const redis = new IORedis(port, host);
        return [redis, async () => server.stop()];
      })
    )
  );

  return [
    redises,
    async () => {
      Promise.all(teardownFns.map((teardown) => teardown()));
    },
  ];
}
