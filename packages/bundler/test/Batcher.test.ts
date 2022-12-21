import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { Queue } from "bullmq";
import { BundlerBatcher } from "../src/batcher";
import {
  PROVEN_OPERATION_QUEUE,
  ProvenOperationJobData,
  PROVEN_OPERATION_JOB_TAG,
  OperationStatus,
} from "../src/common";
import { VALID_PROVEN_OPERATION_OBJ } from "./utils";
import { sleep } from "../src/utils";
import { BatcherDB, StatusDB } from "../src/db";
import * as JSON from "bigint-json-serialization";
import { calculateOperationDigest } from "@nocturne-xyz/sdk";

const BATCH_SIZE = 8;
const MAX_SECONDS = 5;

describe("BundlerBatcher", async () => {
  let server: RedisMemoryServer;
  let redis: IORedis;
  let statusDB: StatusDB;
  let batcherDB: BatcherDB<ProvenOperationJobData>;
  let batcher: BundlerBatcher;

  before(async () => {
    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    redis = new IORedis(port, host);

    statusDB = new StatusDB(redis);
    batcherDB = new BatcherDB(redis);
    batcher = new BundlerBatcher(MAX_SECONDS, BATCH_SIZE, redis); // 6 second wait time
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  async function enqueueOperation(
    queue: Queue<ProvenOperationJobData>,
    num: number
  ): Promise<string> {
    let operationObj = VALID_PROVEN_OPERATION_OBJ;
    operationObj.gasLimit = num.toString() + "n";
    const operationJson = JSON.stringify(operationObj);
    const operation = JSON.parse(operationJson);

    const jobData: ProvenOperationJobData = {
      operationJson,
    };

    const jobId = calculateOperationDigest(operation).toString();
    await queue.add(PROVEN_OPERATION_JOB_TAG, jobData, {
      jobId,
    });

    return jobId;
  }

  it("Batches 8 inbound jobs as full batch", async () => {
    const inboundQueue = new Queue<ProvenOperationJobData>(
      PROVEN_OPERATION_QUEUE,
      {
        connection: redis,
      }
    );

    expect(await batcher.outboundQueue.count()).to.equal(0);
    const batcherPromise = batcher.run();

    let jobIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const jobId = await enqueueOperation(inboundQueue, i);
      jobIds.push(jobId);
    }

    await Promise.race([sleep(1500), batcherPromise]);

    for (const id of jobIds) {
      const status = await statusDB.getJobStatus(id);
      expect(status).to.equal(OperationStatus.PRE_BATCH);
    }
    expect((await batcherDB.getBatch(BATCH_SIZE))!.length).to.equal(6);

    for (let i = 6; i < 8; i++) {
      const jobId = await enqueueOperation(inboundQueue, i);
      jobIds.push(jobId);
    }

    await Promise.race([sleep(1500), batcherPromise]);

    expect(await batcher.outboundQueue.count()).to.equal(1);
    expect(await batcherDB.getBatch(BATCH_SIZE)).to.be.undefined;
    for (const id of jobIds) {
      const status = await statusDB.getJobStatus(id);
      expect(status).to.equal(OperationStatus.IN_BATCH);
    }
  });

  it("Batches 6 inbound jobs after passing wait time", async () => {
    const inboundQueue = new Queue<ProvenOperationJobData>(
      PROVEN_OPERATION_QUEUE,
      {
        connection: redis,
      }
    );

    expect(await batcher.outboundQueue.count()).to.equal(0);
    const batcherPromise = batcher.run();

    let jobIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const jobId = await enqueueOperation(inboundQueue, i);
      jobIds.push(jobId);
    }

    // Sleep 6 seconds, one more than wait time
    await Promise.race([sleep(6000), batcherPromise]);

    expect(await batcher.outboundQueue.count()).to.equal(1);
    expect(await batcherDB.getBatch(BATCH_SIZE)).to.be.undefined;
    for (const id of jobIds) {
      const status = await statusDB.getJobStatus(id);
      expect(status).to.equal(OperationStatus.IN_BATCH);
    }
  });
});
