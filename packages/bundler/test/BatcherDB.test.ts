import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { BundlerBatcherDB } from "../src/db";

describe("BundlerBatcherDB", async () => {
  let server: RedisMemoryServer;
  let redis: IORedis;
  let batcherDB: BundlerBatcherDB<string>;

  before(async () => {
    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);

    batcherDB = new BundlerBatcherDB<string>(redis, 8);
  });

  beforeEach(async () => {
    await redis.flushall();
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
    expect((await batcherDB.getCurrentBatch())!.length).to.equal(8);
    expect(await batcherDB.hasFullBatch()).to.equal(true);

    const batch = await batcherDB.pop(8);
    expect(batch!.length).to.equal(8);
    expect(await batcherDB.getCurrentBatch()).to.be.undefined;
    expect(await batcherDB.pop(8)).to.be.undefined;
    expect(await batcherDB.hasFullBatch()).to.equal(false);
  });
});
