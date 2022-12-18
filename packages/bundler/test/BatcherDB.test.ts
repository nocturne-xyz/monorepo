import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { BatcherDB } from "../src/batcherdb";

describe("BatcherDB", async () => {
  let server: RedisMemoryServer;
  let redis: IORedis;
  let batcherDB: BatcherDB<string>;

  before(async () => {
    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);

    batcherDB = new BatcherDB<string>(redis, 8);
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  after(async () => {
    redis.disconnect();
    await server.stop();
  });

  async function fillBatch(): Promise<void> {
    for (let i = 0; i < 8; i++) {
      await batcherDB.add("ITEM_" + i.toString());
    }
  }

  it("Fills, detects, and pops batch", async () => {
    expect(await batcherDB.hasFullBatch()).to.equal(false);
    expect(await batcherDB.pop(8)).to.be.undefined;

    await fillBatch();

    expect(await batcherDB.hasFullBatch()).to.equal(true);

    const batch = await batcherDB.pop(8);
    expect(batch!.length).to.equal(8);
    expect(await batcherDB.getCurrentBatch()).to.be.undefined;
    expect(await batcherDB.pop(8)).to.be.undefined;
    expect(await batcherDB.hasFullBatch()).to.equal(false);
  });
});
