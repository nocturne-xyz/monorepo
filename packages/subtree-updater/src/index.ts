import { Logger } from "winston";
import { SubtreeUpdaterSyncAdapter } from "./sync";
import {
  ClosableAsyncIterator,
  InMemoryKVStore,
  IncludedNote,
  IncludedNoteCommitment,
  NoteTrait,
  SparseMerkleProver,
  SubtreeUpdateProver,
  assertOrErr,
  packToSolidityProof,
  subtreeUpdateInputsFromBatch,
} from "@nocturne-xyz/sdk";
import { Mutex } from "async-mutex";
import IORedis from "ioredis";
import { Job, Queue, Worker } from "bullmq";
import { ProofJobData, SubmissionJobData } from "./types";
import { Handler } from "@nocturne-xyz/contracts";

export interface SubtreeUpdaterHandle {
  // promise that resovles when the service has fully shut down
  promise: Promise<void>;

  // function to teardown the service
  teardown: () => Promise<void>;
}

const PROOF_QUEUE_NAME = "ROOF_QUEUE";
const SUBMISSION_QUEUE_NAME = "SUBMISSION_QUEUE";

const BATCH_SIZE = 16;
const FALSY_ARRAY = new Array(BATCH_SIZE).fill(false);

export class SubtreeUpdater {
  // TODO: have separate keys instead of a mutex
  handlerMutex: Mutex;
  handlerContract: Handler;
  redis: IORedis;
  adapter: SubtreeUpdaterSyncAdapter;
  logger: Logger;

  tree: SparseMerkleProver;
  prover: SubtreeUpdateProver;

  proofQueue: Queue;
  submissionQueue: Queue;

  startMerkleIndex: number;

  fillBatchTimeout: NodeJS.Timeout | undefined;
  fillBatchLatency: number;

  constructor(
    handlerContract: Handler,
    syncAdapter: SubtreeUpdaterSyncAdapter,
    logger: Logger,
    redis: IORedis,
    prover: SubtreeUpdateProver,
    fillBatchLatency: number
  ) {
    this.handlerMutex = new Mutex();
    this.handlerContract = handlerContract;
    this.redis = redis;
    this.adapter = syncAdapter;
    this.logger = logger;
    this.prover = prover;
    this.fillBatchTimeout = undefined;
    this.fillBatchLatency = fillBatchLatency;

    this.proofQueue = new Queue(PROOF_QUEUE_NAME, { connection: redis });
    this.submissionQueue = new Queue(SUBMISSION_QUEUE_NAME, {
      connection: redis,
    });

    // TODO make this a redis KV store
    const kv = new InMemoryKVStore();
    this.tree = new SparseMerkleProver(kv);

    this.startMerkleIndex = 0;
  }

  async start(queryThrottleMs?: number): Promise<SubtreeUpdaterHandle> {
    this.logger.info(
      `subtree updater starting at merkle index ${this.startMerkleIndex}`
    );
    const proofJobs = this.jobIterator(this.startMerkleIndex, queryThrottleMs);

    const queuer = async () => {
      for await (const job of proofJobs.iter) {
        await this.proofQueue.add(PROOF_QUEUE_NAME, job, {
          attempts: 3,
        });
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

  jobIterator(
    startMerkleIndex: number,
    queryThrottleMs?: number
  ): ClosableAsyncIterator<ProofJobData> {
    return this.adapter
      .iterInsertions(startMerkleIndex, {
        throttleMs: queryThrottleMs,
      })
      .tap(({ merkleIndex }) => {
        // fillBatch logic
        // main idea: keep a call to `fillBatch` on a timeout in the event loop
        // if we get an insertion, reset the timer and kick the call to `fillBatch` down the road
        // if we organically fill the batch, we don't need to call `fillBatch`, so we can simply clear it
        // this is logically equivalent to always clearing the timeout, but only re-setting it if we haven't filled a batch organically yet

        clearTimeout(this.fillBatchTimeout);

        // if the insertion we got is not at a batch boundry, re-set the timeout because we haven't organically filled the batch yet
        if ((merkleIndex + 1) % BATCH_SIZE !== 0) {
          this.fillBatchTimeout = setTimeout(
            () => this.fillbatch(this.logger.child({ function: "fillBatch" })),
            this.fillBatchLatency
          );
        }
      })
      .batches(BATCH_SIZE, true)
      .map((notesOrCommitments) => {
        assertOrErr(
          notesOrCommitments[0].merkleIndex === this.tree.count(),
          "merkle index mismatch"
        );
        assertOrErr(
          notesOrCommitments.length % BATCH_SIZE === 0,
          "batch does not fall on a subtree boundary"
        );
        const subtreeLeftmostPathIndex = this.tree.count();
        const oldRoot = this.tree.getRoot();

        const leaves = notesOrCommitments.map((noteOrCommitment) =>
          NoteTrait.isCommitment(noteOrCommitment)
            ? (noteOrCommitment as IncludedNoteCommitment).noteCommitment
            : NoteTrait.toCommitment(noteOrCommitment as IncludedNote)
        );
        this.tree.insertBatch(subtreeLeftmostPathIndex, leaves, FALSY_ARRAY);

        const batch = notesOrCommitments.map((noteOrCommitment) =>
          NoteTrait.isCommitment(noteOrCommitment)
            ? (noteOrCommitment as IncludedNoteCommitment).noteCommitment
            : NoteTrait.toNote(noteOrCommitment as IncludedNote)
        );
        const merkleProof = this.tree.getProof(subtreeLeftmostPathIndex);
        const proofInputs = subtreeUpdateInputsFromBatch(batch, merkleProof);
        const newRoot = this.tree.getRoot();
        const subtreeIndex = subtreeLeftmostPathIndex / BATCH_SIZE;

        this.logger.info("retrieved batch", {
          subtreeIndex,
          batch,
          oldRoot,
          newRoot,
        });

        return { subtreeIndex, proofInputs, newRoot };
      });
  }

  startProver(logger: Logger): Worker<ProofJobData, any, string> {
    return new Worker(PROOF_QUEUE_NAME, async (job: Job<ProofJobData>) => {
      const { proofInputs, newRoot } = job.data;
      logger.info("handling subtree update prover job", job.data);

      const proof = await this.prover.proveSubtreeUpdate(proofInputs);
      await this.submissionQueue.add(SUBMISSION_QUEUE_NAME, { proof, newRoot });
    });
  }

  startSubmitter(logger: Logger): Worker<SubmissionJobData, any, string> {
    return new Worker(
      SUBMISSION_QUEUE_NAME,
      async (job: Job<SubmissionJobData>) => {
        const { proof, newRoot } = job.data;

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
      }
    );
  }

  private async fillbatch(logger: Logger): Promise<void> {
    logger.debug("acquiring mutex on handler contract to fill batch");
    await this.handlerMutex.runExclusive(async () => {
      logger.info("filling batch...");
      const tx = await this.handlerContract.fillBatchWithZeros();
      await tx.wait(1);
    });
  }
}
