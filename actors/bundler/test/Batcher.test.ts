import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { Queue } from "bullmq";
import { BundlerBatcher } from "../src/batcher";
import {
  SUBMITTABLE_OPERATION_QUEUE,
  OperationJobData,
  PROVEN_OPERATION_JOB_TAG,
} from "../src/types";
import { VALID_RELAY_REQUEST } from "./utils";
import { makeTestLogger } from "@nocturne-xyz/offchain-utils";
import { sleep } from "../src/utils";
import { BatcherDB, StatusDB } from "../src/db";
import * as JSON from "bigint-json-serialization";
import { OperationStatus, computeOperationDigest } from "@nocturne-xyz/core";

const BATCH_SIZE = 8;
const MAX_BATCH_LATENCY_SECS = 5;

describe("BundlerBatcher", async () => {
  let server: RedisMemoryServer;
  let redis: IORedis;
  let statusDB: StatusDB;
  let batcherDB: BatcherDB<OperationJobData>;
  let batcher: BundlerBatcher;
  const logger = makeTestLogger("bundler", "batcher");

  before(async () => {
    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);

    statusDB = new StatusDB(redis);
    batcherDB = new BatcherDB(redis);
    batcher = new BundlerBatcher(
      redis,
      logger,
      MAX_BATCH_LATENCY_SECS,
      BATCH_SIZE
    ); // 6 second wait time
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  async function enqueueOperation(
    queue: Queue<OperationJobData>
  ): Promise<string> {
    let operationObj = VALID_RELAY_REQUEST.operation;
    operationObj.executionGasLimit =
      Math.floor(Math.random() * 100000).toString() + "n";
    const operationJson = JSON.stringify(operationObj);
    const operation = JSON.parse(operationJson);

    const jobData: OperationJobData = {
      operationJson,
    };

    const jobId = computeOperationDigest(operation).toString();
    await queue.add(PROVEN_OPERATION_JOB_TAG, jobData, {
      jobId,
    });

    return jobId;
  }

  it("batches 8 inbound jobs as full batch", async () => {
    const inboundQueue = new Queue<OperationJobData>(
      SUBMITTABLE_OPERATION_QUEUE,
      {
        connection: redis,
      }
    );

    expect(await batcher.outboundQueue.count()).to.equal(0);
    const { promise } = batcher.start();

    let jobIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const jobId = await enqueueOperation(inboundQueue);
      jobIds.push(jobId);
    }

    await Promise.race([sleep(1500), promise]);

    for (const id of jobIds) {
      const status = await statusDB.getJobStatus(id);
      expect(status).to.equal(OperationStatus.PRE_BATCH);
    }
    expect((await batcherDB.getBatch(BATCH_SIZE))!.length).to.equal(6);

    for (let i = 6; i < 8; i++) {
      const jobId = await enqueueOperation(inboundQueue);
      jobIds.push(jobId);
    }

    await Promise.race([sleep(1500), promise]);

    expect(await batcher.outboundQueue.count()).to.equal(1);
    expect(await batcherDB.getBatch(BATCH_SIZE)).to.be.undefined;
    for (const id of jobIds) {
      const status = await statusDB.getJobStatus(id);
      expect(status).to.equal(OperationStatus.IN_BATCH);
    }
  });

  it("batches 6 inbound jobs after passing wait time", async () => {
    const inboundQueue = new Queue<OperationJobData>(
      SUBMITTABLE_OPERATION_QUEUE,
      {
        connection: redis,
      }
    );

    expect(await batcher.outboundQueue.count()).to.equal(0);
    const { promise } = batcher.start();

    let jobIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const jobId = await enqueueOperation(inboundQueue);
      jobIds.push(jobId);
    }

    // Sleep 6 seconds, one more than wait time
    await Promise.race([sleep(6000), promise]);

    expect(await batcher.outboundQueue.count()).to.equal(1);
    expect(await batcherDB.getBatch(BATCH_SIZE)).to.be.undefined;
    for (const id of jobIds) {
      const status = await statusDB.getJobStatus(id);
      expect(status).to.equal(OperationStatus.IN_BATCH);
    }
  });
});