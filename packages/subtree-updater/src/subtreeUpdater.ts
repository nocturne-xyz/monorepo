import { Logger } from "winston";
import { SubtreeUpdaterSyncAdapter } from "./sync";
import {
  ClosableAsyncIterator,
  InMemoryKVStore,
  Note,
  NoteTrait,
  SparseMerkleProver,
  SubtreeUpdateProver,
  packToSolidityProof,
  subtreeUpdateInputsFromBatch,
  range,
} from "@nocturne-xyz/sdk";
import { Mutex } from "async-mutex";
import IORedis from "ioredis";
import { Job, Queue, Worker } from "bullmq";
import {
  ProofJobData,
  SerializedProofJobData,
  SerializedSubmissionJobData,
  SubmissionJobData,
} from "./types";
import { Handler } from "@nocturne-xyz/contracts";
import * as JSON from "bigint-json-serialization";

export interface SubtreeUpdaterHandle {
  // promise that resovles when the service has fully shut down
  promise: Promise<void>;

  // function to teardown the service
  teardown: () => Promise<void>;
}

const PROOF_QUEUE_NAME = "PROOF_QUEUE";
const PROOF_JOB_TAG = "PROOF_JOB";
const SUBMISSION_QUEUE_NAME = "SUBMISSION_QUEUE";
const SUBMISSION_JOB_TAG = "SUBMISSION_JOB";

const BATCH_SIZE = 16;
const SUBTREE_INCLUDE_ARRAY = [true, ...range(BATCH_SIZE - 1).map(() => false)];

export interface SubtreeUpdaterOpts {
  fillBatchLatency?: number;
  startBlock?: number;
}

export class SubtreeUpdater {
  // TODO: have separate keys instead of a mutex
  handlerMutex: Mutex;
  handlerContract: Handler;
  adapter: SubtreeUpdaterSyncAdapter;
  logger: Logger;

  redis: IORedis;
  tree: SparseMerkleProver;
  prover: SubtreeUpdateProver;

  proofQueue: Queue;
  submissionQueue: Queue;

  fillBatchTimeout: NodeJS.Timeout | undefined;
  fillBatchLatency: number | undefined;
  startBlock: number;

  constructor(
    handlerContract: Handler,
    syncAdapter: SubtreeUpdaterSyncAdapter,
    logger: Logger,
    redis: IORedis,
    prover: SubtreeUpdateProver,
    opts?: SubtreeUpdaterOpts
  ) {
    this.handlerMutex = new Mutex();
    this.handlerContract = handlerContract;
    this.adapter = syncAdapter;
    this.logger = logger;
    this.prover = prover;

    this.fillBatchLatency = opts?.fillBatchLatency;
    this.fillBatchTimeout = undefined;

    this.redis = redis;
    this.proofQueue = new Queue(PROOF_QUEUE_NAME, { connection: redis });
    this.submissionQueue = new Queue(SUBMISSION_QUEUE_NAME, {
      connection: redis,
    });

    // TODO make this a redis KV store
    const kv = new InMemoryKVStore();
    this.tree = new SparseMerkleProver(kv);

    this.startBlock = opts?.startBlock ?? 0;
  }

  start(queryThrottleMs?: number): SubtreeUpdaterHandle {
    const proofJobs = this.getProofJobIterator(
      this.logger.child({ function: "iterator" }),
      queryThrottleMs
    );

    const queuer = async () => {
      let latestSubtreeIndex = await this.adapter.fetchLatestSubtreeIndex();
      for await (const job of proofJobs.iter) {
        // only fetch latest subtree index if we need to
        if (job.subtreeIndex > latestSubtreeIndex) {
          latestSubtreeIndex = await this.adapter.fetchLatestSubtreeIndex();
        }

        // queue up a proof job if it hasn't already been committed on-chain
        if (job.subtreeIndex > latestSubtreeIndex) {
          await this.proofQueue.add(PROOF_JOB_TAG, JSON.stringify(job), {
            attempts: 3,
          });
        }

        // mark leftmost leaf of subtree as ready for prune now that job has been queued
        this.tree.markForPruning(job.subtreeIndex * BATCH_SIZE);
        this.tree.prune();
      }
    };

    const prover = this.startProver(this.logger.child({ function: "prover" }));
    const submitter = this.startSubmitter(
      this.logger.child({ function: "submitter" })
    );

    const submitterProm = new Promise<void>((resolve) => {
      submitter.on("closed", () => {
        this.logger.info("submitter stopped");
        resolve();
      });
    });
    const proverProm = new Promise<void>((resolve) => {
      prover.on("closed", () => {
        this.logger.info("prover stopped");
        resolve();
      });
    });
    const queuerProm = queuer();

    return {
      promise: (async () => {
        await Promise.all([submitterProm, proverProm, queuerProm]);
      })(),
      teardown: async () => {
        await proofJobs.close();
        await queuerProm;
        await prover.close();
        await proverProm;
        await submitter.close();
        await submitterProm;
      },
    };
  }

  startProver(logger: Logger): Worker<SerializedProofJobData, any, string> {
    logger.info("starting subtree update prover");
    return new Worker(
      PROOF_QUEUE_NAME,
      async (job: Job<SerializedProofJobData>) => {
        const { proofInputs, newRoot } = JSON.parse(job.data) as ProofJobData;
        logger.info("handling subtree update prover job", job.data);

        const proofWithPis = await this.prover.proveSubtreeUpdate(proofInputs);
        const jobData: SubmissionJobData = {
          proof: proofWithPis.proof,
          newRoot,
        };
        await this.submissionQueue.add(
          SUBMISSION_JOB_TAG,
          JSON.stringify(jobData)
        );
      },
      {
        connection: this.redis,
        autorun: true,
      }
    );
  }

  startSubmitter(
    logger: Logger
  ): Worker<SerializedSubmissionJobData, any, string> {
    logger.info("starting subtree update submitter");
    return new Worker(
      SUBMISSION_QUEUE_NAME,
      async (job: Job<SerializedSubmissionJobData>) => {
        const { proof, newRoot } = JSON.parse(job.data) as SubmissionJobData;

        const solidityProof = packToSolidityProof(proof);
        try {
          logger.debug(
            "acquiring mutex on handler contract to submit update tx"
          );
          await this.handlerMutex.runExclusive(async () => {
            logger.info("submitting tx...");
            const tx = await this.handlerContract.applySubtreeUpdate(
              newRoot,
              solidityProof
            );
            logger.info("waiting for confirmation...");
            await tx.wait(1);
          });

          logger.info("successfully updated root", { newRoot });
        } catch (err: any) {
          // ignore errors that are due to duplicate submissions
          // this can happen if there are multiple instances of subtree updaters running
          if (!err.toString().includes("newRoot already a past root")) {
            logger.error("error submitting proof:", { err });
            throw err;
          }
          logger.warn("update already submitted by another agent");
        }
      },
      {
        connection: this.redis,
        autorun: true,
      }
    );
  }

  private getProofJobIterator(
    logger: Logger,
    queryThrottleMs?: number
  ): ClosableAsyncIterator<ProofJobData> {
    logger.info(`subtree updater iterator starting`);

    let merkleIndex = 0;
    return this.adapter
      .iterInsertions(this.startBlock, {
        throttleMs: queryThrottleMs,
      })
      .tap((_) => {
        merkleIndex += 1;
        if (this.fillBatchLatency === undefined) {
          return;
        }

        // fillBatch logic
        // main idea: keep a call to `fillBatch` on a timeout in the event loop
        // if we get an insertion, reset the timer and kick the call to `fillBatch` down the road
        // if we organically fill the batch, we don't need to call `fillBatch` anymore, so we clear it
        // this is logically equivalent to always clearing the timeout, but only re-setting it if we haven't filled a batch organically yet

        clearTimeout(this.fillBatchTimeout);

        // if the insertion we got is not at a batch boundry, re-set the timeout because we haven't organically filled the batch yet
        if (merkleIndex % BATCH_SIZE !== 0) {
          this.fillBatchTimeout = setTimeout(
            () =>
              this.fillBatchWithZeros(
                this.logger.child({ function: "fillBatch" })
              ),
            this.fillBatchLatency
          );
        }
      })
      .batches(BATCH_SIZE, true)
      .map((batch: (Note | bigint)[]) => {
        const subtreeLeftmostPathIndex = this.tree.count();
        const oldRoot = this.tree.getRoot();

        const leaves = batch.map((noteOrCommitment) =>
          NoteTrait.isCommitment(noteOrCommitment)
            ? (noteOrCommitment as bigint)
            : NoteTrait.toCommitment(noteOrCommitment as Note)
        );
        this.tree.insertBatch(
          subtreeLeftmostPathIndex,
          leaves,
          SUBTREE_INCLUDE_ARRAY
        );

        const merkleProof = this.tree.getProof(subtreeLeftmostPathIndex);
        const proofInputs = subtreeUpdateInputsFromBatch(batch, merkleProof);
        const newRoot = this.tree.getRoot();
        const subtreeIndex = subtreeLeftmostPathIndex / BATCH_SIZE;

        this.logger.info(`got batch for subtree index ${subtreeIndex}`, {
          subtreeIndex,
          batch,
          oldRoot,
          newRoot,
        });

        return { subtreeIndex, proofInputs, newRoot };
      });
  }

  private async fillBatchWithZeros(logger: Logger): Promise<void> {
    logger.debug("acquiring mutex on handler contract to fill batch");
    await this.handlerMutex.runExclusive(async () => {
      logger.info("filling batch...");
      try {
        const tx = await this.handlerContract.fillBatchWithZeros();
        await tx.wait(1);
      } catch (err: any) {
        // if we get revert due to batch already being organically filled, ignore the error
        if (!err.toString().includes("!zero fill empty batch")) {
          logger.error("failed to fill batch", { err });
          throw err;
        }
      }
    });
  }
}
