import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { BatcherDB } from "../src/db";

const BATCH_SIZE = 8;

describe("BatcherDB", async () => {
  let server: RedisMemoryServer;
  let redis: IORedis;
  let batcherDB: BatcherDB<string>;

  before(async () => {
    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);

    batcherDB = new BatcherDB<string>(redis);
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  async function fillBatch(): Promise<void> {
    for (let i = 0; i < BATCH_SIZE; i++) {
      await batcherDB.add("ITEM_" + i.toString());
    }
  }

  it("Fills, detects, and pops batch", async () => {
    expect(await batcherDB.getBatch(BATCH_SIZE)).to.be.undefined;
    expect(await batcherDB.pop(BATCH_SIZE)).to.be.undefined;

    await fillBatch();
    expect((await batcherDB.getBatch(BATCH_SIZE))!.length).to.equal(BATCH_SIZE);

    const batch = await batcherDB.pop(BATCH_SIZE);
    expect(batch!.length).to.equal(BATCH_SIZE);
    expect(await batcherDB.getBatch(BATCH_SIZE)).to.be.undefined;
    expect(await batcherDB.pop(BATCH_SIZE)).to.be.undefined;
  });

  it("Responds to `exact` flag", async () => {
    await fillBatch();

    expect((await batcherDB.getBatch(BATCH_SIZE + 2))!.length).to.equal(
      BATCH_SIZE
    );
    expect(await batcherDB.getBatch(BATCH_SIZE + 2, true)).to.be.undefined;
  });

  it("Produces add and pop transactions", async () => {
    await fillBatch();
    expect((await batcherDB.getBatch(BATCH_SIZE))!.length).to.equal(BATCH_SIZE);

    const addTransaction = batcherDB.getAddTransaction(
      `ITEM_${BATCH_SIZE + 1}`
    );
    const popTransaction = batcherDB.getPopTransaction(BATCH_SIZE + 1);

    const res = await redis
      .multi([addTransaction].concat([popTransaction]))
      .exec();

    expect((res![1][1] as Array<string>).length).to.equal(9);
    expect(await batcherDB.getBatch(BATCH_SIZE)).to.be.undefined;
  });
});
