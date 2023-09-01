import { Logger } from "winston";
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
  BaseProof,
  SubtreeUpdateInputs,
  fetchlatestCommittedMerkleIndex,
} from "@nocturne-xyz/core";
import IORedis from "ioredis";
import { Handler } from "@nocturne-xyz/contracts";
import {
  ActorHandle,
  makeCreateCounterFn,
  Insertion,
  merkleIndexToRedisStreamId,
} from "@nocturne-xyz/offchain-utils";
import * as ot from "@opentelemetry/api";
import { PersistentLog } from "@nocturne-xyz/persistent-log";
import { Mutex } from "async-mutex";
import { ACTOR_NAME, COMPONENT_NAME } from "./constants";

const { BATCH_SIZE } = TreeConstants;
const SUBTREE_INCLUDE_ARRAY = [true, ...range(BATCH_SIZE - 1).map(() => false)];
const INSERTION_LOG_STREAM_NAME = "insertion-log";

export interface SubtreeUpdaterOpts {
  fillBatchLatency?: number;
}

interface SubtreeUpdaterMetrics {
  insertionsReceivedCounter: ot.Counter;
  proofJobsEnqueuedCounter: ot.Counter;
  submissionJobsEnqueuedCounter: ot.Counter;
  subtreeUpdatesSubmittedCounter: ot.Counter;
}

interface BatchInfo {
  leaves: bigint[];
  batch: (Note | bigint)[];
  subtreeBatchOffset: number;
}

export interface ProofInputData {
  subtreeIndex: number;
  newRoot: bigint;
  proofInputs: SubtreeUpdateInputs;
}

export class SubtreeUpdater {
  handlerMutex: Mutex;
  handlerContract: Handler;
  logger: Logger;

  redis: IORedis;
  tree: SparseMerkleProver;
  prover: SubtreeUpdateProver;
  subgraphEndpoint: string;

  insertionLog: PersistentLog<Insertion>;

  fillBatchTimeout: NodeJS.Timeout | undefined;
  fillBatchLatency: number | undefined;
  metrics: SubtreeUpdaterMetrics;

  constructor(
    handlerContract: Handler,
    logger: Logger,
    redis: IORedis,
    prover: SubtreeUpdateProver,
    subgraphEndpoint: string,
    opts?: SubtreeUpdaterOpts
  ) {
    this.handlerContract = handlerContract;
    this.logger = logger;
    this.prover = prover;
    this.subgraphEndpoint = subgraphEndpoint;

    this.fillBatchLatency = opts?.fillBatchLatency;
    this.fillBatchTimeout = undefined;

    this.handlerMutex = new Mutex();
    this.redis = redis;

    // TODO make this a redis KV store
    const kv = new InMemoryKVStore();
    this.tree = new SparseMerkleProver(kv);

    const meter = ot.metrics.getMeter(COMPONENT_NAME);
    const createCounter = makeCreateCounterFn(
      meter,
      ACTOR_NAME,
      COMPONENT_NAME
    );

    this.insertionLog = new PersistentLog<Insertion>(
      this.redis,
      INSERTION_LOG_STREAM_NAME,
      {
        logger: logger.child({ function: "PersistentLog" }),
      }
    );

    this.metrics = {
      insertionsReceivedCounter: createCounter(
        "insertions_received.counter",
        "Insertions received by proof job iterator"
      ),
      proofJobsEnqueuedCounter: createCounter(
        "proof_jobs_enqueued.counter",
        "Proof jobs enqueued for proving"
      ),
      submissionJobsEnqueuedCounter: createCounter(
        "submission_jobs_enqueued.counter",
        "Proven subtree updates enqueued for submission"
      ),
      subtreeUpdatesSubmittedCounter: createCounter(
        "subtree_updates_submitted.counter",
        "Subtree update txs submitted to chain"
      ),
    };
  }

  async recoverTree(
    logger: Logger,
    latestCommittedMerkleIndex: number
  ): Promise<void> {
    if (this.tree.count() > 0) {
      throw new Error("canont recover non-empty tree");
    }

    logger.info("recovering tree from fresh state");
    // scan over the insertion in large batches, starting from the beginning
    // stop when we've recovered up to the latest committed merkle index
    const previousInsertions = this.insertionLog.scan({
      // end is exclusive, so we add 1 to get everything up to and through the latest committed merkle index
      endId: merkleIndexToRedisStreamId(latestCommittedMerkleIndex + 1),
      // we want to ensure we get all of the insertions up to `endId` even if insertion writer is behind,
      // se we set `infinite` to true so we block until we get all of the committed insertions
      infinite: true,
    });

    for await (const wrappedInsertions of previousInsertions.iter) {
      const includes = [
        true,
        ...range(wrappedInsertions.length - 1).map(() => false),
      ];
      const insertions = wrappedInsertions.map(({ inner }) => inner);
      const { leaves, subtreeBatchOffset } =
        batchInfoFromInsertions(insertions);
      this.tree.insertBatch(subtreeBatchOffset, leaves, includes);
      logger.debug(`recovered up to merkleIndex ${this.tree.count() - 1}`);
    }
  }

  async start(): Promise<ActorHandle> {
    const logger = this.logger.child({ function: "start" });
    logger.info("starting subtree updater");

    const latestCommittedMerkleIndexAtStart =
      await fetchlatestCommittedMerkleIndex(this.subgraphEndpoint);

    if (latestCommittedMerkleIndexAtStart !== undefined) {
      // recover in-memory tree from insertion log up to and including the latest committed subtree
      await this.recoverTree(
        this.logger.child({ function: "recoverTree" }),
        latestCommittedMerkleIndexAtStart ?? 0
      );
    }

    // construct infinite iterator over all new and future insertions from the log
    const startId = latestCommittedMerkleIndexAtStart
      ? merkleIndexToRedisStreamId(latestCommittedMerkleIndexAtStart + 1)
      : undefined;
    logger.info(`starting iterator at stream ID ${startId}`);
    const allInsertions = ClosableAsyncIterator.flatMap(
      this.insertionLog.scan({
        startId,
        infinite: true,
      }),
      ({ inner }) => inner
    );

    const proofInputInfos = allInsertions
      // update fill batch timer if necessary
      .tap(({ merkleIndex }) => {
        this.maybeScheduleFillBatch(merkleIndex);
      })
      // make batches
      .batches(BATCH_SIZE, true)
      // metrics
      .tap((batch) => {
        for (const insertion of batch) {
          logger.info(`got insertion at merkleIndex ${insertion.merkleIndex}`, {
            insertion,
          });

          const noteOrCommitment = NoteTrait.isCommitment(insertion)
            ? "commitment"
            : "note";

          this.metrics.insertionsReceivedCounter.add(1, { noteOrCommitment });
        }
      })
      // flatten batch into leaves + additional info needed for proof gen
      .map(batchInfoFromInsertions)
      // insert batches into in-memory tree
      .tap(({ leaves, subtreeBatchOffset }) => {
        this.tree.insertBatch(
          subtreeBatchOffset,
          leaves,
          SUBTREE_INCLUDE_ARRAY
        );
      })
      // make proof inputs
      .map(({ batch, subtreeBatchOffset }) => {
        const merkleProof = this.tree.getProof(subtreeBatchOffset);
        const proofInputs = subtreeUpdateInputsFromBatch(batch, merkleProof);

        const newRoot = this.tree.getRoot();
        const subtreeIndex = subtreeBatchOffset / BATCH_SIZE;
        logger.info(`created proof inputs for subtree index ${subtreeIndex}`, {
          subtreeIndex,
          batch,
          newRoot,
        });

        return { subtreeIndex, proofInputs, newRoot };
      });

    // consume the iterator and make proofs
    const run = async () => {
      for await (const {
        proofInputs,
        newRoot,
        subtreeIndex,
      } of proofInputInfos.iter) {
        const logMetadata = {
          subtreeIndex,
          subtreebatchOffest: subtreeIndex * BATCH_SIZE,
          newRoot,
        };

        logger.info("generating subtree update proof", logMetadata);
        const proofWithPis = await this.prover.proveSubtreeUpdate(proofInputs);
        logger.info("successfully generated proof", logMetadata);

        await this.submitSubtreeUpdate(
          logger.child({ function: "submitSubtreeUpdate" }),
          proofWithPis.proof,
          newRoot,
          subtreeIndex
        );
      }
    };

    // package up into an ActorHandle
    const runProm = run();

    const teardown = async () => {
      await proofInputInfos.close();
      await runProm;
      this.logger.info("teardown completed");
    };

    const promise = (async () => {
      try {
        await runProm;
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

  async submitSubtreeUpdate(
    logger: Logger,
    proof: BaseProof,
    newRoot: bigint,
    subtreeIndex: number
  ): Promise<void> {
    const solidityProof = packToSolidityProof(proof);
    try {
      logger.debug(
        `acquiring mutex on handler contract to submit update tx for subtree index ${subtreeIndex}`
      );
      const receipt = await this.handlerMutex.runExclusive(async () => {
        logger.info(
          `pre-dispatch attempting tx submission. subtreeIndex: ${subtreeIndex}`
        );
        const tx = await this.handlerContract.applySubtreeUpdate(
          newRoot,
          solidityProof
        );

        logger.info(
          `post-dispatch awaiting tx receipt. subtreeIndex: ${subtreeIndex}. txhash: ${tx.hash}`
        );
        const receipt = await tx.wait(1);
        return receipt;
      });

      logger.info("subtree update tx receipt:", { receipt, subtreeIndex });
      logger.info("successfully updated root", { newRoot, subtreeIndex });
      this.metrics.subtreeUpdatesSubmittedCounter.add(1);
    } catch (err: any) {
      // ignore errors that are due to duplicate submissions
      // this can happen if there are multiple instances of subtree updaters running
      if (!err.toString().includes("newRoot already a past root")) {
        logger.error("error submitting proof:", { err });
        throw err;
      }

      logger.warn("update already submitted by another agent", {
        error: err,
        subtreeIndex,
      });
    }
  }

  // update fill batch timer upon reciept of a new insertion at index `newInsertionMerkleIndex`
  private maybeScheduleFillBatch(newInsertionMerkleIndex: number): void {
    if (!this.fillBatchLatency) {
      return;
    }

    clearTimeout(this.fillBatchTimeout);

    // if the insertion we got is not at a batch boundry, re-set the timeout because we haven't organically filled the batch yet
    if ((newInsertionMerkleIndex + 1) % BATCH_SIZE !== 0) {
      this.fillBatchTimeout = setTimeout(
        () =>
          this.fillBatchWithZeros(this.logger.child({ function: "fillBatch" })),
        this.fillBatchLatency
      );
    }
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

function batchInfoFromInsertions(insertions: Insertion[]): BatchInfo {
  const subtreeBatchOffset = insertions[0].merkleIndex;

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

  return {
    leaves,
    batch,
    subtreeBatchOffset,
  };
}
