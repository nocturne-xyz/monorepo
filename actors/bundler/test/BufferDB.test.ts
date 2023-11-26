import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { BufferDB } from "../src/db";
import { unixTimestampSeconds } from "../src/utils";

const BATCH_SIZE = 8;

describe("BufferDB", async () => {
  let server: RedisMemoryServer;
  let redis: IORedis;
  let bufferDB: BufferDB<string>;

  before(async () => {
    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);

    bufferDB = new BufferDB<string>("FAST", redis);
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  async function fillBatch(): Promise<void> {
    for (let i = 0; i < BATCH_SIZE; i++) {
      await bufferDB.add("ITEM_" + i.toString());
    }
  }

  it("fills, detects, and pops batch", async () => {
    expect(await bufferDB.getBatch(BATCH_SIZE)).to.be.undefined;
    expect(await bufferDB.pop(BATCH_SIZE)).to.be.undefined;
    expect(await bufferDB.getWindowStart()).to.be.undefined;

    await fillBatch();
    expect((await bufferDB.getBatch(BATCH_SIZE))!.length).to.equal(BATCH_SIZE);
    expect(await bufferDB.getWindowStart()).to.be.lessThanOrEqual(
      unixTimestampSeconds()
    );

    const batch = await bufferDB.pop(BATCH_SIZE);
    expect(batch!.length).to.equal(BATCH_SIZE);
    expect(await bufferDB.getBatch(BATCH_SIZE)).to.be.undefined;
    expect(await bufferDB.pop(BATCH_SIZE)).to.be.undefined;
  });

  it("responds to `exact` flag", async () => {
    await fillBatch();

    expect((await bufferDB.getBatch(BATCH_SIZE + 2))!.length).to.equal(
      BATCH_SIZE
    );
    expect(await bufferDB.getBatch(BATCH_SIZE + 2, true)).to.be.undefined;
  });

  it("produces add and pop transactions", async () => {
    await fillBatch();
    expect((await bufferDB.getBatch(BATCH_SIZE))!.length).to.equal(BATCH_SIZE);

    const addTransaction = bufferDB.getAddTransaction(`ITEM_${BATCH_SIZE + 1}`);
    const popTransaction = bufferDB.getPopTransaction(BATCH_SIZE + 1);

    const res = await redis
      .multi([addTransaction].concat([popTransaction]))
      .exec();

    expect((res![1][1] as Array<string>).length).to.equal(9);
    expect(await bufferDB.getBatch(BATCH_SIZE)).to.be.undefined;
  });
});
