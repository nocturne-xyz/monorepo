import IORedis from "ioredis";
import { Job, Queue, Worker } from "bullmq";
import { BatcherDB, StatusDB } from "./db";
import {
  OperationStatus,
  computeOperationDigest,
  ProvenOperation,
} from "@nocturne-xyz/core";
import {
  OperationBatchJobData,
  OPERATION_BATCH_QUEUE,
  OPERATION_BATCH_JOB_TAG,
  ProvenOperationJobData,
  PROVEN_OPERATION_QUEUE,
  ACTOR_NAME,
} from "./types";
import * as JSON from "bigint-json-serialization";
import { actorChain } from "./utils";
import { Logger } from "winston";
import {
  ActorHandle,
  makeCreateCounterFn,
  makeCreateHistogramFn,
} from "@nocturne-xyz/offchain-utils";
import * as ot from "@opentelemetry/api";

const COMPONENT_NAME = "batcher";

export interface BundlerBatcherMetrics {
  relayRequestsEnqueuedInBatcherDBCounter: ot.Counter;
  relayRequestsBatchedCounter: ot.Counter;
  batchesCreatedCounter: ot.Counter;
  batchLatencyHistogram: ot.Histogram;
  batchSizeHistogram: ot.Histogram;
}

export class BundlerBatcher {
  redis: IORedis;
  statusDB: StatusDB;
  batcherDB: BatcherDB<ProvenOperation>;
  outboundQueue: Queue<OperationBatchJobData>;
  logger: Logger;
  metrics: BundlerBatcherMetrics;
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
    this.logger = logger;
    this.statusDB = new StatusDB(redis);
    this.batcherDB = new BatcherDB(redis);
    this.outboundQueue = new Queue(OPERATION_BATCH_QUEUE, {
      connection: redis,
    });

    const meter = ot.metrics.getMeter(COMPONENT_NAME);
    const createCounter = makeCreateCounterFn(
      meter,
      ACTOR_NAME,
      COMPONENT_NAME
    );
    const createHistogram = makeCreateHistogramFn(
      meter,
      ACTOR_NAME,
      COMPONENT_NAME
    );

    this.metrics = {
      relayRequestsEnqueuedInBatcherDBCounter: createCounter(
        "relay_requests_enqueued_in_batcher_db.counter",
        "Number of relay requests enqueued in batcher DB"
      ),
      relayRequestsBatchedCounter: createCounter(
        "relay_requests_batched.counter",
        "Number of relay requests batched"
      ),
      batchesCreatedCounter: createCounter(
        "batches_created.counter",
        "Number of batches created"
      ),
      batchLatencyHistogram: createHistogram(
        "batch_latency.histogram",
        "Histogram of number of seconds delay until batch created (lesser of time to full batch or  max latency)"
      ),
      batchSizeHistogram: createHistogram(
        "batch_size.histogram",
        "Histogram of batch sizes"
      ),
    };
  }

  start(): ActorHandle {
    const batcher = this.startBatcher();
    const queuer = this.startQueuer();
    return actorChain(batcher, queuer);
  }

  startBatcher(): ActorHandle {
    const logger = this.logger.child({ function: "batcher" });
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

            logger.info(`Creating batch. batch size: ${batch.length}`);
            await this.redis.multi(allTransactions).exec((maybeErr) => {
              if (maybeErr) {
                const msg = `failed to set operation job and/or remove batch from DB: ${maybeErr}`;
                logger.error(msg);
                throw Error(msg);
              }
            });

            // Update metrics
            this.metrics.relayRequestsBatchedCounter.add(batch.length);
            this.metrics.batchesCreatedCounter.add(1);
            this.metrics.batchLatencyHistogram.record(counterSeconds);
            this.metrics.batchSizeHistogram.record(batch.length);

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
    const logger = this.logger.child({ function: "queuer" });
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

        logger.info(`Adding operation to batcher DB. op digest: ${job.id}`);
        await this.redis.multi(allTransactions).exec((maybeErr) => {
          if (maybeErr) {
            const msg = `failed to execute batcher add and set job status transaction: ${maybeErr}`;
            logger.error(msg);
            throw new Error(msg);
          }
        });

        this.metrics.relayRequestsEnqueuedInBatcherDBCounter.add(1);
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
