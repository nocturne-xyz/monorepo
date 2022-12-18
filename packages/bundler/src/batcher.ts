import IORedis from "ioredis";
import { Job, Queue, Worker } from "bullmq";
import { BatcherDB } from "./db";
import { getRedis, sleep } from "./utils";
import { ProvenOperation } from "@nocturne-xyz/sdk";
import {
  OperationBatchJobData,
  OPERATION_BATCH_QUEUE,
  OPERATION_BATCH_JOB_TAG,
  ProvenOperationJobData,
  PROVEN_OPERATION_QUEUE,
} from "./common";
import { keccak256 } from "ethers/lib/utils";

export class BatcherWorker {
  redis: IORedis;
  batcherDB: BatcherDB<ProvenOperation>;
  outboundQueue: Queue<OperationBatchJobData>;
  readonly INTERVAL_SECONDS: number = 60;
  readonly BATCH_SIZE: number = 8;

  constructor(intervalSeconds?: number, batchSize?: number, redis?: IORedis) {
    if (batchSize) {
      this.BATCH_SIZE = batchSize;
    }

    if (intervalSeconds) {
      this.INTERVAL_SECONDS = intervalSeconds;
    }

    const connection = getRedis(redis);
    this.redis = connection;
    this.batcherDB = new BatcherDB(connection, batchSize);
    this.outboundQueue = new Queue(OPERATION_BATCH_QUEUE, { connection });
  }

  async runInboundQueuer(): Promise<any[]> {
    const worker = new Worker(
      PROVEN_OPERATION_QUEUE,
      async (job: Job<ProvenOperationJobData>) => {
        const provenOperation = JSON.parse(
          job.data.operationJson
        ) as ProvenOperation;

        await this.batcherDB.add(provenOperation);
      },
      {
        connection: this.redis,
        autorun: false,
      }
    );

    return worker.run();
  }

  async runOutboundBatcher(): Promise<void> {
    let counterSeconds = 0;
    while (true) {
      const batch = await this.batcherDB.getCurrentBatch();

      if (!batch) {
        continue;
      } else if (
        batch.length == this.BATCH_SIZE ||
        (counterSeconds >= this.INTERVAL_SECONDS && batch.length > 0)
      ) {
        const operationBatchJson = JSON.stringify(batch);
        const operationBatchData: OperationBatchJobData = {
          operationBatchJson,
        };

        // TODO: race condition where crash occurs between queue.add and
        // batcherDB.pop
        const jobId = keccak256(operationBatchJson);
        await this.outboundQueue.add(
          OPERATION_BATCH_JOB_TAG,
          operationBatchData,
          { jobId }
        );
        await this.batcherDB.pop(batch.length);
      }

      await sleep(950); // sleep ~1 sec, increment counter (approx)
      counterSeconds += 1;
    }
  }

  async run(): Promise<void> {
    const queuerPromise = this.runInboundQueuer();
    const batcherPromise = this.runOutboundBatcher();
    await Promise.all([queuerPromise, batcherPromise]);
  }
}
