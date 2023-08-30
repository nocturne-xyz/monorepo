import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { TestTreeInsertionSyncAdapter } from "./testSyncAdapter";
import { range, sleep, unzip } from "@nocturne-xyz/core";
import { PersistentLog } from "@nocturne-xyz/persistent-log";
import { Insertion } from "../src/sync/syncAdapter";
import { makeTestLogger } from "@nocturne-xyz/offchain-utils";
import { InsertionWriter } from "../src";

describe("TestTreeInsertionSyncAdapter", () => {
  it("replicates insertion log into one persistent log", async () => {
    const [redises, teardown] = await makeRedises(1);

    const adapter = new TestTreeInsertionSyncAdapter();
    const logger = makeTestLogger("testInsertionLog.ts", "replicates insertion log into one persistent log");
    const writer = new InsertionWriter(adapter, redises[0], logger);

    const handle = await writer.start();
    await sleep(50_000);
  })
});

// returns redises and a teardown function
async function makeRedises(numRedises: number): Promise<[IORedis[], () => Promise<void>]> {
  const [redises, teardownFns] = unzip(await Promise.all(range(numRedises).map(async () => {
    const server = await RedisMemoryServer.create();
    const host = await server.getHost();
    const port = await server.getPort();
    const redis = new IORedis(port, host);
    return [redis, async () => server.stop()];
  })));

  return [redises, async () => { Promise.all(teardownFns.map(teardown => teardown()))}];
}
