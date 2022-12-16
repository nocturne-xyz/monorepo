import "mocha";
import { expect } from "chai";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { BundlerWorker } from "../src/worker";
import { Queue } from "bullmq";
import {
  PROVEN_OPERATIONS_QUEUE,
  RelayJobData,
  RELAY_JOB_TYPE,
} from "../src/common";
import { VALID_RELAY_OBJECT } from "./utils";

describe("BundlerWorker", async () => {
  let server: RedisMemoryServer;
  let redis: IORedis;
  let worker: BundlerWorker;
  let submittedBatch: boolean;

  before(async () => {
    server = await RedisMemoryServer.create();

    const host = await server.getHost();
    const port = await server.getPort();
    console.log(`Host: ${host}. Port: ${port}`);
    redis = new IORedis(port, host);

    process.env.RPC_URL = "https://localhost:8080";
    process.env.TX_SIGNER_KEY =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    worker = new BundlerWorker("BundlerWorker", "0x1234", redis);
    worker.submitBatch = async () => {
      submittedBatch = true;
    };
  });

  beforeEach(async () => {
    submittedBatch = false;
    await redis.flushall();
  });

  after(async () => {
    await worker.worker.close();
    redis.disconnect();
    await server.stop();
  });

  it("Runs", async () => {
    const queue = new Queue(PROVEN_OPERATIONS_QUEUE, { connection: redis });
    // const prom = worker.run();
    const fillBatch = async () => {
      for (let i = 0; i < 8; i++) {
        const jobId = (i + 1).toString();
        const operationJson = JSON.stringify(VALID_RELAY_OBJECT);
        const jobData: RelayJobData = {
          operationJson,
        };

        const job = await queue.add(RELAY_JOB_TYPE, jobData, {
          jobId,
        });
        expect(jobId).to.equal(job.id!);
        console.log(job);
      }
    };

    await fillBatch();
    submittedBatch = true;
    submittedBatch;
  });
});
