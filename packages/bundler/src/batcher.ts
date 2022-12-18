import IORedis from "ioredis";
import { Job, Queue, Worker } from "bullmq";
import { BatcherDB, StatusDB } from "./db";
import { getRedis, sleep } from "./utils";
import { calculateOperationDigest, ProvenOperation } from "@nocturne-xyz/sdk";
import {
  OperationBatchJobData,
  OPERATION_BATCH_QUEUE,
  OPERATION_BATCH_JOB_TAG,
  ProvenOperationJobData,
  PROVEN_OPERATION_QUEUE,
  OperationStatus,
} from "./common";
import { sha256 } from "js-sha256";
import * as JSON from "bigint-json-serialization";

export class Batcher {
  redis: IORedis;
  statusDB: StatusDB;
  batcherDB: BatcherDB<ProvenOperation>;
  outboundQueue: Queue<OperationBatchJobData>;
  readonly MAX_SECONDS: number = 60;
  readonly BATCH_SIZE: number = 8;

  constructor(maxSeconds?: number, batchSize?: number, redis?: IORedis) {
    if (batchSize) {
      this.BATCH_SIZE = batchSize;
    }

    if (maxSeconds) {
      this.MAX_SECONDS = maxSeconds;
    }

    const connection = getRedis(redis);
    this.redis = connection;
    this.statusDB = new StatusDB(connection);
    this.batcherDB = new BatcherDB(connection, batchSize);
    this.outboundQueue = new Queue(OPERATION_BATCH_QUEUE, { connection });
  }

  async run(): Promise<void> {
    const queuerPromise = this.runInboundQueuer();
    const batcherPromise = this.runOutboundBatcher();
    await Promise.all([queuerPromise, batcherPromise]);
  }

  async runInboundQueuer(): Promise<void> {
    const worker = new Worker(
      PROVEN_OPERATION_QUEUE,
      async (job: Job<ProvenOperationJobData>) => {
        const provenOperation = JSON.parse(
          job.data.operationJson
        ) as ProvenOperation;

        await this.batcherDB.add(provenOperation);
        await this.statusDB.setJobStatus(job.id!, OperationStatus.PRE_BATCH);
      },
      {
        connection: this.redis,
        autorun: false,
      }
    );

    await worker.run();
  }

  async runOutboundBatcher(): Promise<void> {
    let counterSeconds = 0;
    while (true) {
      const batch = await this.batcherDB.getCurrentBatch();
      if (!batch) {
        continue;
      } else if (
        batch.length >= this.BATCH_SIZE ||
        (counterSeconds >= this.MAX_SECONDS && batch.length > 0)
      ) {
        const operationBatchJson = JSON.stringify(batch);
        const operationBatchData: OperationBatchJobData = {
          operationBatchJson,
        };

        // TODO: race condition where crash occurs between queue.add and
        // batcherDB.pop
        const jobId = sha256(operationBatchJson);
        await this.outboundQueue.add(
          OPERATION_BATCH_JOB_TAG,
          operationBatchData,
          { jobId }
        );
        await this.batcherDB.pop(batch.length);

        batch.forEach(async (op) => {
          const jobId = calculateOperationDigest(op).toString();
          await this.statusDB.setJobStatus(jobId, OperationStatus.IN_BATCH);
        });

        counterSeconds = 0;
      }

      await sleep(950); // sleep ~1 sec, increment counter (approx)
      counterSeconds += 1;
    }
  }
}
