import IORedis from "ioredis";
import { Job, Queue, Worker } from "bullmq";
import { BatcherDB, StatusDB } from "./db";
import {
  OperationStatus,
  computeOperationDigest,
  ProvenOperation,
} from "@nocturne-xyz/sdk";
import {
  OperationBatchJobData,
  OPERATION_BATCH_QUEUE,
  OPERATION_BATCH_JOB_TAG,
  ProvenOperationJobData,
  PROVEN_OPERATION_QUEUE,
} from "./common";
import * as JSON from "bigint-json-serialization";

export class BundlerBatcher {
  redis: IORedis;
  statusDB: StatusDB;
  batcherDB: BatcherDB<ProvenOperation>;
  outboundQueue: Queue<OperationBatchJobData>;
  readonly MAX_BATCH_LATENCY_SECS: number = 60;
  readonly BATCH_SIZE: number = 8;

  constructor(redis: IORedis, maxLatencySeconds?: number, batchSize?: number) {
    if (batchSize) {
      this.BATCH_SIZE = batchSize;
    }

    if (maxLatencySeconds) {
      this.MAX_BATCH_LATENCY_SECS = maxLatencySeconds;
    }

    this.redis = redis;
    this.statusDB = new StatusDB(redis);
    this.batcherDB = new BatcherDB(redis);
    this.outboundQueue = new Queue(OPERATION_BATCH_QUEUE, {
      connection: redis,
    });
  }

  start(): [Promise<void>, () => Promise<void>] {
    let stopped = false;
    console.log("batcher starting...");

    // **** BATCHER ****
    let counterSeconds = 0;
    let intervalId: NodeJS.Timer;
    const batcherProm = new Promise<void>(() => {
      intervalId = setInterval(async () => {
        // if 
        if (stopped) {
          clearInterval(intervalId);
          return;
        }

        const batch = await this.batcherDB.getBatch(this.BATCH_SIZE);
        if (batch) {
          if (
            (batch && batch.length >= this.BATCH_SIZE) ||
            (counterSeconds >= this.MAX_BATCH_LATENCY_SECS && batch.length > 0)
          ) {
            const operationBatchJson = JSON.stringify(batch);
            const operationBatchData: OperationBatchJobData = {
              operationBatchJson,
            };

            // TODO: race condition where crash occurs between queue.add and
            // batcherDB.pop
            await this.outboundQueue.add(
              OPERATION_BATCH_JOB_TAG,
              operationBatchData
            );

            const popTransaction = this.batcherDB.getPopTransaction(
              batch.length
            );
            const setJobStatusTransactions = batch.map((op) => {
              const jobId = computeOperationDigest(op).toString();
              return this.statusDB.getSetJobStatusTransaction(
                jobId,
                OperationStatus.IN_BATCH
              );
            });
            const allTransactions = setJobStatusTransactions.concat([
              popTransaction,
            ]);
            await this.redis.multi(allTransactions).exec((maybeErr) => {
              if (maybeErr) {
                throw Error(
                  `BatcherDB job status + pop txs failed: ${maybeErr}`
                );
              }
            });

            counterSeconds = 0;
          }

          counterSeconds += 1;
        }
      }, 1000);

    });

    // in the case of an early failure, clearTimeout
    // if we've stopped due to the teardown function, this will be a no-op
    batcherProm.finally(() => clearTimeout(intervalId));

    // **** QUEUER ****
    const queuer = new Worker(
      PROVEN_OPERATION_QUEUE,
      async (job: Job<ProvenOperationJobData>) => {
        const provenOperation = JSON.parse(
          job.data.operationJson
        ) as ProvenOperation;

        const batcherAddTransaction =
          this.batcherDB.getAddTransaction(provenOperation);
        const setJobStatusTransaction =
          this.statusDB.getSetJobStatusTransaction(
            job.id!,
            OperationStatus.PRE_BATCH
          );
        const allTransactions = [batcherAddTransaction].concat([
          setJobStatusTransaction,
        ]);
        await this.redis.multi(allTransactions).exec((maybeErr) => {
          if (maybeErr) {
            throw new Error(
              `Failed to execute batcher add and set job status transaction: ${maybeErr}`
            );
          }
        });
      },
      {
        connection: this.redis,
        autorun: false,
      }
    );

    return [
      (async () => { await queuer.run() })(),
      async () => {
        if (stopped) { 
          return;
        }

        stopped = true;

        await Promise.all([queuer.close(), batcherProm]);
      }
    ]
  }
}
