import { Teller, Teller__factory } from "@nocturne-xyz/contracts";
import { OperationProcessedEvent } from "@nocturne-xyz/contracts/dist/src/Teller";
import {
  Address,
  computeOperationDigest,
  ProvenOperation,
  OperationStatus,
  parseEventsFromContractReceipt,
} from "@nocturne-xyz/sdk";
import { Job, Worker } from "bullmq";
import IORedis from "ioredis";
import { ethers } from "ethers";
import {
  ACTOR_NAME,
  OPERATION_BATCH_QUEUE,
  OperationBatchJobData,
} from "./types";
import { NullifierDB, RedisTransaction, StatusDB } from "./db";
import * as JSON from "bigint-json-serialization";
import { Logger } from "winston";
import {
  ActorHandle,
  makeCreateCounterFn,
  makeCreateHistogramFn,
} from "@nocturne-xyz/offchain-utils";
import * as ot from "@opentelemetry/api";

const COMPONENT_NAME = "submitter";

interface BundlerSubmitterMetrics {
  bundlesSubmittedCounter: ot.Counter;
  operationsSubmittedCounter: ot.Counter;
  operationStatusHistogram: ot.Histogram;
}

export class BundlerSubmitter {
  redis: IORedis;
  signingProvider: ethers.Signer;
  tellerContract: Teller;
  statusDB: StatusDB;
  nullifierDB: NullifierDB;
  logger: Logger;
  metrics: BundlerSubmitterMetrics;

  readonly INTERVAL_SECONDS: number = 60;
  readonly BATCH_SIZE: number = 8;

  constructor(
    tellerAddress: Address,
    signingProvider: ethers.Signer,
    redis: IORedis,
    logger: Logger
  ) {
    this.redis = redis;
    this.logger = logger;
    this.statusDB = new StatusDB(this.redis);
    this.nullifierDB = new NullifierDB(this.redis);
    this.signingProvider = signingProvider;
    this.tellerContract = Teller__factory.connect(
      tellerAddress,
      this.signingProvider
    );

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
      bundlesSubmittedCounter: createCounter(
        "bundles_submitted.counter",
        "Number of bundles submitted "
      ),
      operationsSubmittedCounter: createCounter(
        "operations_submitted.counter",
        "Number of operations submitted "
      ),
      operationStatusHistogram: createHistogram(
        "operation_status.histogram",
        "Histogram of operation statuses after submission"
      ),
    };
  }

  start(): ActorHandle {
    const worker = new Worker(
      OPERATION_BATCH_QUEUE,
      async (job: Job<OperationBatchJobData>) => {
        const operations: ProvenOperation[] = JSON.parse(
          job.data.operationBatchJson
        );

        const opDigests = operations.map((op) =>
          computeOperationDigest(op).toString()
        );
        const logger = this.logger.child({
          function: "submitBatch",
          bundle: opDigests,
        });

        await this.submitBatch(logger, operations).catch((e) => {
          throw new Error(e);
        });

        this.metrics.operationsSubmittedCounter.add(operations.length);
        this.metrics.bundlesSubmittedCounter.add(1);
      },
      { connection: this.redis, autorun: true }
    );

    this.logger.info(
      `submitter starting... teller contract: ${this.tellerContract.address}.`
    );

    const promise = new Promise<void>((resolve) => {
      worker.on("closed", () => {
        this.logger.info("submitter stopped.");
        resolve();
      });
    });

    return {
      promise,
      teardown: async () => {
        await worker.close();
        await promise;
      },
    };
  }

  async submitBatch(
    logger: Logger,
    operations: ProvenOperation[]
  ): Promise<void> {
    // TODO: this job isn't idempotent. If one step fails, bullmq will re-try
    // which may cause issues. Current plan is to mark reverted bundles as
    // failed. Will circle back after further testing and likely
    // re-queue/re-validate ops in the reverted bundle.

    logger.info("submitting bundle...");

    logger.debug("setting ops to inflight...");
    await this.setOpsToInflight(logger, operations);

    logger.debug("dispatching bundle...");
    const receipt = await this.dispatchBundle(logger, operations);
    logger.info("dispatch bundle tx receipt: ", { receipt });

    if (!receipt) {
      logger.error("bundle reverted");
      return;
    }

    logger = logger.child({ txHash: receipt.transactionHash });

    logger.debug("performing post-submission bookkeeping");
    await this.performPostSubmissionBookkeeping(logger, operations, receipt);
  }

  async setOpsToInflight(
    logger: Logger,
    operations: ProvenOperation[]
  ): Promise<void> {
    // Loop through current batch and set each job status to IN_FLIGHT
    const inflightStatusTransactions = operations.map((op) => {
      const jobId = computeOperationDigest(op).toString();
      logger.info(
        `setting operation with digest ${jobId} to status IN_FLIGHT`,
        { opDigest: jobId }
      );
      return this.statusDB.getSetJobStatusTransaction(
        jobId,
        OperationStatus.IN_FLIGHT
      );
    });

    await this.redis.multi(inflightStatusTransactions).exec((maybeErr) => {
      if (maybeErr) {
        const msg = `failed to set job status transactions to IN_FLIGHT: ${maybeErr}`;
        logger.error(msg);
        throw new Error(msg);
      }
    });
  }

  async dispatchBundle(
    logger: Logger,
    operations: ProvenOperation[]
  ): Promise<ethers.ContractReceipt | undefined> {
    try {
      // Estimate gas first
      const data = this.tellerContract.interface.encodeFunctionData(
        "processBundle",
        [{ operations }]
      );
      const gasEst = await this.signingProvider.estimateGas({
        to: this.tellerContract.address,
        data,
      });

      logger.info("pre-dispatch attempting tx submission");
      const tx = await this.tellerContract.processBundle(
        { operations },
        { gasLimit: gasEst.toBigInt() + 200_000n }
      );

      logger.info(`post-dispatch awaiting tx receipt. txhash: ${tx.hash}`);
      const receipt = await tx.wait(1);
      return receipt;
    } catch (err) {
      logger.error("failed to process bundle:", err);
      const redisTxs = operations.flatMap((op) => {
        const digest = computeOperationDigest(op);
        logger.error(
          `setting operation with digest ${digest} to status BUNDLE_REVERTED`
        );
        const statusTx = this.statusDB.getSetJobStatusTransaction(
          digest.toString(),
          OperationStatus.BUNDLE_REVERTED
        );

        const nullifierTx = this.nullifierDB.getRemoveNullifierTransactions(op);

        return [statusTx, ...nullifierTx];
      });

      await this.redis.multi(redisTxs).exec((maybeErr) => {
        if (maybeErr) {
          const msg = `failed to update operation statuses to BUNDLE_REVERTED and/or remove their nullifiers from DB: ${maybeErr}`;
          logger.error(msg);
          throw new Error(msg);
        }
      });

      this.metrics.operationStatusHistogram.record(operations.length, {
        status: OperationStatus.BUNDLE_REVERTED.toString(),
      });
      return undefined;
    }
  }

  async performPostSubmissionBookkeeping(
    logger: Logger,
    operations: ProvenOperation[],
    receipt: ethers.ContractReceipt
  ): Promise<void> {
    const digestsToOps = new Map(
      operations.map((op) => [computeOperationDigest(op), op])
    );

    logger.debug("looking for OperationProcessed events...");
    const matchingEvents = parseEventsFromContractReceipt(
      receipt,
      this.tellerContract.interface.getEvent("OperationProcessed")
    ) as OperationProcessedEvent[];

    logger.info("matching events:", { matchingEvents });

    const redisTxs: RedisTransaction[] = [];
    const statuses: OperationStatus[] = [];
    for (const { args } of matchingEvents) {
      const digest = args.operationDigest.toBigInt();

      let status: OperationStatus;
      if (!args.assetsUnwrapped) {
        status = OperationStatus.OPERATION_PROCESSING_FAILED;
      } else if (!args.opProcessed) {
        status = OperationStatus.OPERATION_EXECUTION_FAILED;
      } else {
        status = OperationStatus.EXECUTED_SUCCESS;
      }

      logger.info(
        `setting operation with digest ${digest} to status ${status}`,
        { opDigest: digest, status: status.toString() }
      );
      redisTxs.push(
        this.statusDB.getSetJobStatusTransaction(digest.toString(), status)
      );
      statuses.push(status);

      if (status == OperationStatus.OPERATION_PROCESSING_FAILED) {
        logger.warn(
          `op with digest ${args.operationDigest.toBigInt()} failed during handleOperation. removing nullifers from DB...`,
          { opDigest: args.operationDigest.toBigInt() }
        );
        const op = digestsToOps.get(args.operationDigest.toBigInt())!;
        redisTxs.push(...this.nullifierDB.getRemoveNullifierTransactions(op));
      }
    }

    await this.redis.multi(redisTxs).exec((maybeErr) => {
      if (maybeErr) {
        const msg = `failed to set operation statuses and/or remove nullfiers after bundle executed: ${maybeErr}`;
        logger.error(msg);
        throw new Error(msg);
      }
    });

    // Record op statuses
    for (const status of statuses) {
      this.metrics.operationStatusHistogram.record(1, {
        status: status.toString(),
      });
    }
  }
}
