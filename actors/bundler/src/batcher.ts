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
import { unixTimestampSeconds } from "./utils";
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

export interface BatcherOpts {
  pollIntervalSeconds?: number;
  mediumBatchLatencySeconds?: number;
  slowBatchLatencySeconds?: number;
  mediumBatchSize?: number;
  slowBatchSize?: number;
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

  readonly pollIntervalSeconds: number = 30 * 60;
  readonly mediumBatchLatencySeconds: number = 3 * 60 * 60;
  readonly slowBatchLatencySeconds: number = 6 * 60 * 60;

  readonly mediumBatchSize: number = 3;
  readonly slowBatchSize: number = 7;

  constructor(redis: IORedis, logger: Logger, opts?: BatcherOpts) {
    if (opts?.pollIntervalSeconds) {
      this.pollIntervalSeconds = opts.pollIntervalSeconds;
    }
    if (opts?.mediumBatchLatencySeconds) {
      this.mediumBatchLatencySeconds = opts.mediumBatchLatencySeconds;
    }
    if (opts?.slowBatchLatencySeconds) {
      this.slowBatchLatencySeconds = opts.slowBatchLatencySeconds;
    }

    if (opts?.mediumBatchSize) {
      this.mediumBatchSize = opts.mediumBatchSize;
    }
    if (opts?.slowBatchSize) {
      this.slowBatchSize = opts.slowBatchSize;
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

    const currentTime = unixTimestampSeconds();
    const [_fastTimestamp, mediumTimestamp, slowTimestamp] = [
      (await this.fastBuffer.getWindowStart()) ?? currentTime,
      (await this.mediumBuffer.getWindowStart()) ?? currentTime,
      (await this.slowBuffer.getWindowStart()) ?? currentTime,
    ];

    const clearBufferTransactions = [];

    console.log("slow time diff", currentTime - slowTimestamp);
    console.log("slow latency", this.slowBatchLatencySeconds);
    if (
      slowBatch &&
      (fastSize + mediumSize + slowSize >= 7 ||
        currentTime - slowTimestamp >= this.slowBatchLatencySeconds)
    ) {
      this.logger.info("creating slow batch", {
        slowBatch,
        fastSize,
        mediumSize,
        slowSize,
        timeDiff: currentTime - slowTimestamp,
      });
      batch.push(...slowBatch);
      clearBufferTransactions.push(this.slowBuffer.getPopTransaction(slowSize));
    }

    if (
      mediumBatch &&
      (batch.length + mediumSize + fastSize >= 3 ||
        currentTime - mediumTimestamp >= this.mediumBatchLatencySeconds)
    ) {
      this.logger.info("creating medium batch", {
        mediumBatch,
        fastSize,
        mediumSize,
        slowSize,
        timeDiff: currentTime - mediumTimestamp,
      });
      batch.push(...mediumBatch);
      clearBufferTransactions.push(
        this.mediumBuffer.getPopTransaction(mediumSize)
      );
    }

    if (fastBatch) {
      this.logger.info("creating fast batch", {
        fastBatch,
        fastSize,
        mediumSize,
        slowSize,
        timeDiff: currentTime - mediumTimestamp,
      });
      batch.push(...fastBatch);
      clearBufferTransactions.push(this.fastBuffer.getPopTransaction(fastSize));
    }

    // add batch to outbound queue if non empty
    if (batch.length > 0) {
      this.logger.info("adding batch to outbound queue", { batch });
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
      this.logger.debug("clearing buffers and setting job statuses");
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
  }

  start(): ActorHandle {
    const logger = this.logger.child({ function: "batcher" });
    let timeoutId: NodeJS.Timeout;

    const promise = new Promise<void>((resolve) => {
      const poll = async () => {
        this.logger.info("polling...");

        if (this.stopped) {
          this.logger.info("batcher stopping...");
          clearTimeout(timeoutId);
          resolve();
          return;
        }

        await this.tryCreateBatch();

        timeoutId = setTimeout(poll, this.pollIntervalSeconds * 1000);
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
