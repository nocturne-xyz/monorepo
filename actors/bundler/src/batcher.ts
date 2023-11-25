import IORedis from "ioredis";
import { Queue } from "bullmq";
import { BatcherDB, StatusDB } from "./db";
import {
  OperationStatus,
  OperationTrait,
  SubmittableOperationWithNetworkInfo,
} from "@nocturne-xyz/core";
import {
  OperationBatchJobData,
  OPERATION_BATCH_QUEUE,
  OPERATION_BATCH_JOB_TAG,
  ACTOR_NAME,
} from "./types";
import * as JSON from "bigint-json-serialization";
import { actorChain, unixTimestampSeconds } from "./utils";
import { Logger } from "winston";
import {
  ActorHandle,
  makeCreateCounterFn,
  makeCreateHistogramFn,
} from "@nocturne-xyz/offchain-utils";
import * as ot from "@opentelemetry/api";

const COMPONENT_NAME = "batcher";
const SECONDS_IN_HOUR = 3600;

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
  fastBuffer: BatcherDB<SubmittableOperationWithNetworkInfo>;
  mediumBuffer: BatcherDB<SubmittableOperationWithNetworkInfo>;
  slowBuffer: BatcherDB<SubmittableOperationWithNetworkInfo>;
  outboundQueue: Queue<OperationBatchJobData>;
  logger: Logger;
  metrics: BundlerBatcherMetrics;
  stopped = false;

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
    this.fastBuffer = new BatcherDB("FAST", redis);
    this.mediumBuffer = new BatcherDB("MEDIUM", redis);
    this.slowBuffer = new BatcherDB("SLOW", redis);
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

  async tryCreateBatch() {
    const batch = [];
    const [fastBatch, mediumBatch, slowBatch] = [
      await this.fastBuffer.getBatch(),
      await this.mediumBuffer.getBatch(),
      await this.slowBuffer.getBatch(),
    ];
    const [fastSize, mediumSize, slowSize] = [
      fastBatch?.length ?? 0,
      mediumBatch?.length ?? 0,
      slowBatch?.length ?? 0,
    ];
    const [_fastTimestamp, mediumTimestamp, slowTimestamp] = [
      await this.fastBuffer.getWindowStart(),
      await this.mediumBuffer.getWindowStart(),
      await this.slowBuffer.getWindowStart(),
    ];

    const clearBufferTransactions = [];
    const currentTime = unixTimestampSeconds();

    if (
      slowBatch &&
      ((fastBatch?.length ?? 0) +
        (mediumBatch?.length ?? 0) +
        (slowBatch.length ?? 0) >=
        7 ||
        currentTime - slowTimestamp >= 6 * SECONDS_IN_HOUR)
    ) {
      batch.push(...slowBatch);
      clearBufferTransactions.push(this.slowBuffer.getPopTransaction(slowSize));
    }

    if (
      mediumBatch &&
      (batch.length + mediumSize + fastSize >= 3 ||
        currentTime - mediumTimestamp >= 3 * SECONDS_IN_HOUR)
    ) {
      batch.push(...mediumBatch);
      clearBufferTransactions.push(
        this.mediumBuffer.getPopTransaction(mediumSize)
      );
    }

    if (fastBatch) {
      batch.push(...fastBatch);
      clearBufferTransactions.push(this.fastBuffer.getPopTransaction(fastSize));
    }

    // add batch to outbound queue
    const operationBatchJson = JSON.stringify(batch);
    const operationBatchData: OperationBatchJobData = {
      operationBatchJson,
    };
    await this.outboundQueue.add(OPERATION_BATCH_JOB_TAG, operationBatchData);

    // create set status redis txs
    const setJobStatusTransactions = batch.map((op) => {
      const jobId = OperationTrait.computeDigest(op).toString();
      return this.statusDB.getSetJobStatusTransaction(
        jobId,
        OperationStatus.IN_BATCH
      );
    });

    // execute set status + clear buffer txs
    const allTransactions = setJobStatusTransactions.concat(
      clearBufferTransactions
    );
    await this.redis.multi(allTransactions).exec((maybeErr) => {
      if (maybeErr) {
        const msg = `failed to set operation job and/or remove batch from DB: ${maybeErr}`;
        this.logger.error(msg);
        throw Error(msg);
      }
    });

    this.metrics.relayRequestsBatchedCounter.add(batch.length);
    this.metrics.batchesCreatedCounter.add(1);
    this.metrics.batchSizeHistogram.record(batch.length);
  }

  start(): ActorHandle {
    const logger = this.logger.child({ function: "batcher" });
    const promise = new Promise<void>((resolve) => {
      const poll = async () => {
        this.logger.info("polling...");

        if (this.stopped) {
          this.logger.info("Balance Monitor stopping...");
          resolve();
          return;
        }

        await this.tryCreateBatch();

        setTimeout(poll, 30 * 60); // 1800 seconds = 30m
      };

      void poll();
    });

    return {
      promise,
      teardown: async () => {
        this.stopped = true;
        await promise;
        logger.info("teardown complete");
      },
    };
  }
}
