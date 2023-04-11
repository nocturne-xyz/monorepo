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
import { ActorHandle, actorChain } from "./utils";
import { Logger } from "winston";

export class BundlerBatcher {
  redis: IORedis;
  statusDB: StatusDB;
  batcherDB: BatcherDB<ProvenOperation>;
  outboundQueue: Queue<OperationBatchJobData>;
  _logger: Logger;
  readonly MAX_BATCH_LATENCY_SECS: number = 60;
  readonly BATCH_SIZE: number = 8;

  constructor(
    redis: IORedis,
    logger: Logger,
    maxLatencySeconds?: number,
    batchSize?: number
  ) {
    if (batchSize) {
      this.BATCH_SIZE = batchSize;
    }

    if (maxLatencySeconds) {
      this.MAX_BATCH_LATENCY_SECS = maxLatencySeconds;
    }

    this.redis = redis;
    this._logger = logger;
    this.statusDB = new StatusDB(redis);
    this.batcherDB = new BatcherDB(redis);
    this.outboundQueue = new Queue(OPERATION_BATCH_QUEUE, {
      connection: redis,
    });
  }

  start(): ActorHandle {
    const batcher = this.startBatcher();
    const queuer = this.startQueuer();
    return actorChain(batcher, queuer);
  }

  startBatcher(): ActorHandle {
    const logger = this._logger.child({ function: "batcher" });
    logger.info("starting batcher...");

    let stopped = false;
    const promise = new Promise<void>((resolve) => {
      let counterSeconds = 0;
      const poll = async () => {
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
                const msg = `failed to set operation job and/or remove batch from DB: ${maybeErr}`;
                logger.error(msg);
                throw Error(msg);
              }
            });

            counterSeconds = 0;
          }

          counterSeconds += 1;
        }

        if (stopped) {
          logger.info("stopping...");
          resolve();
        } else {
          setTimeout(poll, 1000);
        }
      };

      void poll();
    });

    return {
      promise,
      teardown: async () => {
        stopped = true;
        await promise;
        logger.info("teardown complete");
      },
    };
  }

  startQueuer(): ActorHandle {
    const logger = this._logger.child({ function: "queuer" });
    logger.info("starting queuer...");
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
            const msg = `failed to execute batcher add and set job status transaction: ${maybeErr}`;
            logger.error(msg);
            throw new Error(msg);
          }
        });
      },
      {
        connection: this.redis,
        autorun: true,
      }
    );

    const promise = new Promise<void>((resolve) => {
      queuer.on("closed", () => {
        logger.info("stopping...");
        resolve();
      });
    });

    return {
      promise,
      teardown: async () => {
        await queuer.close();
        await promise;
        logger.info("teardown complete");
      },
    };
  }
}
