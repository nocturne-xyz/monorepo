import IORedis from "ioredis";
import { Job, Queue, Worker } from "bullmq";
import { BatcherDB, StatusDB } from "./db";
import { getRedis } from "./utils";
import { OperationStatus, calculateOperationDigest, ProvenOperation } from "@nocturne-xyz/sdk";
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

  constructor(maxLatencySeconds?: number, batchSize?: number, redis?: IORedis) {
    if (batchSize) {
      this.BATCH_SIZE = batchSize;
    }

    if (maxLatencySeconds) {
      this.MAX_BATCH_LATENCY_SECS = maxLatencySeconds;
    }

    const connection = getRedis(redis);
    this.redis = connection;
    this.statusDB = new StatusDB(connection);
    this.batcherDB = new BatcherDB(connection);
    this.outboundQueue = new Queue(OPERATION_BATCH_QUEUE, { connection });
  }

  async run(): Promise<void> {
    const queuerPromise = this.runInboundQueuer();
    const batcherPromise = this.runOutboundBundlerBatcher();

    console.log("Batcher running...");
    await Promise.all([queuerPromise, batcherPromise]);
  }

  async runInboundQueuer(): Promise<void> {
    const worker = new Worker(
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

    await worker.run();
  }

  async runOutboundBundlerBatcher(): Promise<void> {
    let counterSeconds = 0;
    let intervalId: NodeJS.Timer;

    const prom = new Promise<void>(() => {
      intervalId = setInterval(async () => {
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
              const jobId = calculateOperationDigest(op).toString();
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

    prom.finally(() => clearTimeout(intervalId));
  }
}
