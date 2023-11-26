import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { BundlerBatcher } from "../src/batcher";
import { VALID_RELAY_REQUEST } from "./utils";
import { makeTestLogger } from "@nocturne-xyz/offchain-utils";
import { sleep } from "../src/utils";
import { BufferDB, BufferSpeed, StatusDB } from "../src/db";
import * as JSON from "bigint-json-serialization";
import {
  OperationStatus,
  OperationTrait,
  SubmittableOperationWithNetworkInfo,
} from "@nocturne-xyz/core";

const BATCH_SIZE = 8;

describe("BundlerBatcher", async () => {
  let server: RedisMemoryServer;
  let redis: IORedis;
  let statusDB: StatusDB;
  let fastBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
  let mediumBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
  let slowBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
  let batcher: BundlerBatcher;
  let promise: Promise<void>;
  let teardown: () => Promise<void>;
  const logger = makeTestLogger("bundler", "batcher");

  before(async () => {
    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);

    statusDB = new StatusDB(redis);
    fastBuffer = new BufferDB("FAST", redis);
    mediumBuffer = new BufferDB("MEDIUM", redis);
    slowBuffer = new BufferDB("SLOW", redis);
  });

  beforeEach(async () => {
    batcher = new BundlerBatcher(redis, logger, {
      pollIntervalSeconds: 3,
      mediumBatchLatencySeconds: 5,
      slowBatchLatencySeconds: 10,
    });
    ({ promise, teardown } = batcher.start());
  });

  afterEach(async () => {
    await teardown();
    await redis.flushall();
  });

  async function enqueueOperation(speed: BufferSpeed): Promise<string> {
    let operationObj = VALID_RELAY_REQUEST.operation;
    operationObj.executionGasLimit =
      Math.floor(Math.random() * 100000).toString() + "n";

    const operation = JSON.parse(JSON.stringify(operationObj));
    if (speed === "FAST") {
      await fastBuffer.add(operation);
    } else if (speed === "MEDIUM") {
      await mediumBuffer.add(operation);
    } else {
      await slowBuffer.add(operation);
    }

    const digest = OperationTrait.computeDigest(operation).toString();
    await statusDB.setJobStatus(digest, OperationStatus.PRE_BATCH);
    return digest;
  }

  it("batches 8 ops as full batch", async () => {
    expect(await batcher.outboundQueue.count()).to.equal(0);

    let jobIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const jobId = await enqueueOperation("SLOW");
      jobIds.push(jobId);
    }

    await Promise.race([sleep(1500), promise]);

    for (const id of jobIds) {
      const status = await statusDB.getJobStatus(id);
      expect(status).to.equal(OperationStatus.PRE_BATCH);
    }
    expect((await slowBuffer.getBatch(BATCH_SIZE))!.length).to.equal(6);

    for (let i = 6; i < 8; i++) {
      const jobId = await enqueueOperation("MEDIUM");
      jobIds.push(jobId);
    }

    await Promise.race([sleep(1500), promise]);

    expect(await batcher.outboundQueue.count()).to.equal(1);
    expect(await slowBuffer.getBatch(BATCH_SIZE)).to.be.undefined;
    expect(await mediumBuffer.getBatch(BATCH_SIZE)).to.be.undefined;
    expect(await slowBuffer.size()).to.equal(0);
    expect(await mediumBuffer.size()).to.equal(0);
    for (const id of jobIds) {
      const status = await statusDB.getJobStatus(id);
      expect(status).to.equal(OperationStatus.IN_BATCH);
    }
  });

  it("batches 6 slow ops after passing wait time", async () => {
    expect(await batcher.outboundQueue.count()).to.equal(0);

    let jobIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const jobId = await enqueueOperation("SLOW");
      jobIds.push(jobId);
    }

    // Sleep 5 seconds, still more time to wait for slow
    await Promise.race([sleep(5_000), promise]);

    expect(await slowBuffer.size()).to.equal(6);
    expect(await batcher.outboundQueue.count()).to.equal(0);

    // Sleep 6 more seconds, now slow window should have passed
    await Promise.race([sleep(8_000), promise]);

    expect(await batcher.outboundQueue.count()).to.equal(1);
    expect(await slowBuffer.getBatch(BATCH_SIZE)).to.be.undefined;
    expect(await slowBuffer.size()).to.equal(0);
    for (const id of jobIds) {
      const status = await statusDB.getJobStatus(id);
      expect(status).to.equal(OperationStatus.IN_BATCH);
    }
  });
});
