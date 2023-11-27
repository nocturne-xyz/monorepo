import IORedis from "ioredis";
import { Queue } from "bullmq";
import { BufferDB, StatusDB } from "./db";
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
  relayRequestsEnqueuedInBufferDBCounter: ot.Counter;
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
  fastBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
  mediumBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
  slowBuffer: BufferDB<SubmittableOperationWithNetworkInfo>;
  outboundQueue: Queue<OperationBatchJobData>;
  logger: Logger;
  metrics: BundlerBatcherMetrics;
  stopped = false;

  readonly pollIntervalSeconds: number = 30 * 60; // default 30 minutes
  readonly mediumBatchLatencySeconds: number = 3 * 60 * 60; // default 3 hours
  readonly slowBatchLatencySeconds: number = 6 * 60 * 60; // default 6 hours

  readonly mediumBatchSize: number = 3; // default 3 existing ops, next op will be 4th
  readonly slowBatchSize: number = 7; // default 7 existing ops, next op will be 8th

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
    this.fastBuffer = new BufferDB("FAST", redis);
    this.mediumBuffer = new BufferDB("MEDIUM", redis);
    this.slowBuffer = new BufferDB("SLOW", redis);
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
      relayRequestsEnqueuedInBufferDBCounter: createCounter(
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

  async tryCreateBatch(): Promise<void> {
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
      (await this.fastBuffer.windowStart()) ?? currentTime,
      (await this.mediumBuffer.windowStart()) ?? currentTime,
      (await this.slowBuffer.windowStart()) ?? currentTime,
    ];

    const bufferUpdateTransactions = [];

    if (
      slowBatch &&
      (fastSize + mediumSize + slowSize >= this.slowBatchSize ||
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
      bufferUpdateTransactions.push(
        this.slowBuffer.getPopTransaction(slowSize)
      );
      bufferUpdateTransactions.push(
        this.slowBuffer.getClearWindowStartTransaction()
      );
    }

    if (
      mediumBatch &&
      (batch.length + mediumSize + fastSize >= this.mediumBatchSize ||
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
      bufferUpdateTransactions.push(
        this.mediumBuffer.getPopTransaction(mediumSize)
      );
      bufferUpdateTransactions.push(
        this.mediumBuffer.getClearWindowStartTransaction()
      );
    }

    if (fastBatch) {
      this.logger.info("creating fast batch", {
        fastBatch,
        fastSize,
        mediumSize,
        slowSize,
      });
      batch.push(...fastBatch);
      bufferUpdateTransactions.push(
        this.fastBuffer.getPopTransaction(fastSize)
      );
      bufferUpdateTransactions.push(
        this.fastBuffer.getClearWindowStartTransaction()
      );
    }

    // add batch to outbound queue if non empty
    if (batch.length > 0) {
      this.logger.info("adding batch to outbound queue", { batch });
      const operationBatchJson = JSON.stringify(batch);
      const operationBatchData: OperationBatchJobData = {
        operationBatchJson,
      };
      await this.outboundQueue.add(OPERATION_BATCH_JOB_TAG, operationBatchData);

      // TODO: if crash happens between queue.add and status setting, state will be out of sync
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
        bufferUpdateTransactions
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
