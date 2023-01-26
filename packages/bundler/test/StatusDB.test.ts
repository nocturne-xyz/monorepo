import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { StatusDB } from "../src/db";
import { OperationStatus } from "@nocturne-xyz/sdk";

describe("StatusDB", async () => {
  let server: RedisMemoryServer;
  let redis: IORedis;
  let statusDB: StatusDB;

  before(async () => {
    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);

    statusDB = new StatusDB(redis);
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  it("Sets and gets job status", async () => {
    const id = "1234";
    await statusDB.setJobStatus(id, OperationStatus.QUEUED);
    expect(await statusDB.getJobStatus(id)).to.equal(OperationStatus.QUEUED);

    await statusDB.setJobStatus(id, OperationStatus.IN_BATCH);
    expect(await statusDB.getJobStatus(id)).to.equal(OperationStatus.IN_BATCH);
  });

  it("Produces set job status transaction", async () => {
    const id = "1234";
    const tx = statusDB.getSetJobStatusTransaction(id, OperationStatus.QUEUED);
    await redis.multi([tx]).exec();

    expect(await statusDB.getJobStatus(id)).to.equal(OperationStatus.QUEUED);
  });
});
