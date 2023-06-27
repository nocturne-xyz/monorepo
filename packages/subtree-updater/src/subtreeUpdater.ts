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
  TreeConstants,
  IncludedNote,
  IncludedNoteCommitment,
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
import { ActorHandle } from "@nocturne-xyz/offchain-utils";
import { Insertion } from "./sync/syncAdapter";
import { PersistentLog } from "./persistentLog";
import * as txManager from "@nocturne-xyz/tx-manager";

const { BATCH_SIZE } = TreeConstants;

const PROOF_QUEUE_NAME = "PROOF_QUEUE";
const PROOF_JOB_TAG = "PROOF_JOB";
const SUBMISSION_QUEUE_NAME = "SUBMISSION_QUEUE";
const SUBMISSION_JOB_TAG = "SUBMISSION_JOB";

const SUBTREE_INCLUDE_ARRAY = [true, ...range(BATCH_SIZE - 1).map(() => false)];

export interface SubtreeUpdaterOpts {
  fillBatchLatency?: number;
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
  }

  async start(queryThrottleMs?: number): Promise<ActorHandle> {
    const proofJobs = await this.getProofJobIterator(
      this.logger.child({ function: "iterator" }),
      queryThrottleMs
    );

    const queuer = async () => {
      for await (const job of proofJobs.iter) {
        const latestSubtreeIndex = await this.adapter.fetchLatestSubtreeIndex(); // update latest subtree index

        // If this is the first proof ever, enqueue
        if (!latestSubtreeIndex) {
          await this.proofQueue.add(PROOF_JOB_TAG, JSON.stringify(job));
        } else if (job.subtreeIndex > latestSubtreeIndex) {
          // If job is for new subtree, enqueue
          await this.proofQueue.add(PROOF_JOB_TAG, JSON.stringify(job));

          // mark leftmost leaf of subtree as ready for prune now that job has been queued
          this.tree.markForPruning(job.subtreeIndex * BATCH_SIZE);
          this.tree.prune();
        }
      }
    };

    const prover = this.startProver(this.logger.child({ function: "prover" }));
    const submitter = this.startSubmitter(
      this.logger.child({ function: "submitter" })
    );

    const submitterProm = new Promise<void>((resolve, reject) => {
      submitter.on("closed", () => {
        this.logger.info("submitter stopped");
        resolve();
      });

      submitter.on("error", (err) => {
        this.logger.error("submitter error", err);
        reject(err);
      });

      submitter.on("failed", () => {
        this.logger.error("submitter job failed");
        reject(new Error("submitter job failed"));
      });
    });

    const proverProm = new Promise<void>((resolve, reject) => {
      prover.on("closed", () => {
        this.logger.info("prover stopped");
        resolve();
      });

      prover.on("error", (err) => {
        this.logger.error("prover error", { err });
        reject(err);
      });

      prover.on("failed", () => {
        this.logger.info("prover failed");
        reject(new Error("prover failed"));
      });
    });

    const queuerProm = queuer();

    const teardown = async () => {
      await Promise.allSettled([
        proofJobs.close(),
        prover.close(),
        submitter.close(),
      ]);

      await Promise.allSettled([submitterProm, proverProm, queuerProm]);

      this.logger.debug("teardown completed");
    };

    const promise = (async () => {
      try {
        await Promise.all([submitterProm, proverProm, queuerProm]);
      } catch (err) {
        this.logger.error(`error in subtree updater`, { err });
        await teardown();
        throw err;
      }
    })();

    return {
      promise,
      teardown,
    };
  }

  startProver(logger: Logger): Worker<SerializedProofJobData, any, string> {
    logger.info("starting subtree update prover");
    return new Worker(
      PROOF_QUEUE_NAME,
      async (job: Job<SerializedProofJobData>) => {
        const { proofInputs, newRoot } = JSON.parse(job.data) as ProofJobData;
        logger.info("handling subtree update prover job", { job: job.data });

        const proofWithPis = await this.prover.proveSubtreeUpdate(proofInputs);
        logger.info("successfully generated proof", {
          job: job.data,
          proofWithPis,
        });
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
          const receipt = await this.handlerMutex.runExclusive(async () => {
            const nonce =
              await this.handlerContract.signer.getTransactionCount(); // ensure its replacement
            const contractTx = async (gasPrice: number) => {
              const tx = await this.handlerContract.applySubtreeUpdate(
                newRoot,
                solidityProof,
                { gasPrice, nonce }
              );

              logger.info(
                `attempting tx manager submission. txhash: ${tx.hash} gas price: ${gasPrice}`
              );
              return tx.wait(1);
            };

            const startingGasPrice =
              await this.handlerContract.provider.getGasPrice();
            logger.info(`starting gas price: ${startingGasPrice}`);

            return await txManager.send({
              sendTransactionFunction: contractTx,
              minGasPrice: startingGasPrice.toNumber(),
              maxGasPrice: startingGasPrice.toNumber() * 20, // up to 20x starting gas price
              gasPriceScalingFunction: txManager.LINEAR(1), // +1 gwei each time
              delay: 20_000, // Waits 20s between each try
            });
          });

          logger.info("subtree update tx receipt:", { receipt });
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

  private async getProofJobIterator(
    logger: Logger,
    queryThrottleMs?: number
  ): Promise<ClosableAsyncIterator<ProofJobData>> {
    logger.info(`subtree updater iterator starting`);

    const log = new PersistentLog<Insertion>(
      this.redis,
      logger.child({ function: "PersistentLog" })
    );
    const logTip = await log.getLatestTotalEntityIndex();
    logger.info("current tip in redis", { totalEntityIndex: logTip });

    const previousInsertions = log.scan();
    const newInsertions = log.syncAndPipe(
      this.adapter.iterInsertions(logTip ? logTip + 1n : 0n, {
        throttleMs: queryThrottleMs,
      })
    );

    const allInsertions = ClosableAsyncIterator.flatMap(
      previousInsertions.chain(newInsertions),
      ({ inner }) => inner
    );

    return allInsertions
      .tap(({ merkleIndex, ...insertion }) => {
        logger.debug(`got insertion at merkleIndex ${merkleIndex}`, {
          insertion,
        });
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
        if ((merkleIndex + 1) % BATCH_SIZE !== 0) {
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
      .map((insertions: Insertion[]) => {
        const subtreeBatchOffset = insertions[0].merkleIndex;
        const oldRoot = this.tree.getRoot();
        logger.debug(`got batch with leftmost index ${subtreeBatchOffset}`, {
          insertions,
        });

        const batch: (Note | bigint)[] = insertions.map((noteOrCommitment) =>
          NoteTrait.isCommitment(noteOrCommitment)
            ? (noteOrCommitment as IncludedNoteCommitment).noteCommitment
            : NoteTrait.toNote(noteOrCommitment as IncludedNote)
        );

        const leaves = batch.map((noteOrCommitment) =>
          typeof noteOrCommitment === "bigint"
            ? noteOrCommitment
            : NoteTrait.toCommitment(noteOrCommitment as Note)
        );

        logger.debug(
          `inserting batch into local SMP tree with offset ${subtreeBatchOffset}`,
          { subtreeBatchOffset, leaves }
        );
        this.tree.insertBatch(
          subtreeBatchOffset,
          leaves,
          SUBTREE_INCLUDE_ARRAY
        );

        const merkleProof = this.tree.getProof(subtreeBatchOffset);
        const proofInputs = subtreeUpdateInputsFromBatch(batch, merkleProof);
        const newRoot = this.tree.getRoot();
        const subtreeIndex = subtreeBatchOffset / BATCH_SIZE;

        logger.info(`created proof inputs for subtree index ${subtreeIndex}`, {
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
