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
  handlerContract: Handler;
  redis: IORedis;
  adapter: SubtreeUpdaterSyncAdapter;
  logger: Logger;

  tree: SparseMerkleProver;
  prover: SubtreeUpdateProver;

  proofQueue: Queue;
  submissionQueue: Queue;

  currentBlock: number;

  constructor(
    handlerContract: Handler,
    syncAdapter: SubtreeUpdaterSyncAdapter,
    logger: Logger,
    redis: IORedis,
    prover: SubtreeUpdateProver
  ) {
    this.handlerContract = handlerContract;
    this.redis = redis;
    this.adapter = syncAdapter;
    this.logger = logger;
    this.prover = prover;

    this.proofQueue = new Queue(PROOF_QUEUE_NAME, { connection: redis });
    this.submissionQueue = new Queue(SUBMISSION_QUEUE_NAME, {
      connection: redis,
    });

    // TODO make this a redis KV store
    const kv = new InMemoryKVStore();
    this.tree = new SparseMerkleProver(kv);

    this.currentBlock = 0;
  }

  async start(queryThrottleMs?: number): Promise<SubtreeUpdaterHandle> {
    this.logger.info(`subtree updater starting from ${this.currentBlock}`);

    // setup sync adaper, convert to proof jobs
    const proofJobs: ClosableAsyncIterator<ProofJobData> = this.adapter
      .iterInsertions(this.currentBlock, {
        throttleMs: queryThrottleMs,
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
          logger.info("submitting tx...");
          const tx = await this.handlerContract.applySubtreeUpdate(
            newRoot,
            solidityProof
          );
          logger.info("waiting for confirmation...");
          await tx.wait(1);

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
}
