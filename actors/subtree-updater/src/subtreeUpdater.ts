import { Logger } from "winston";
import {
  ClosableAsyncIterator,
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
  SubgraphUtils,
} from "@nocturne-xyz/core";
import IORedis from "ioredis";
import { Handler } from "@nocturne-xyz/contracts";
import {
  ActorHandle,
  TxSubmitter,
  makeCreateCounterFn,
} from "@nocturne-xyz/offchain-utils";
import * as ot from "@opentelemetry/api";
import { TreeInsertionLog, Insertion } from "@nocturne-xyz/persistent-log";
import { Mutex } from "async-mutex";
import { ACTOR_NAME, COMPONENT_NAME } from "./constants";
import retry from "async-retry";

const { fetchLatestCommittedMerkleIndex } = SubgraphUtils;
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
  txSubmitter: TxSubmitter;
  logger: Logger;

  redis: IORedis;
  tree: SparseMerkleProver;
  prover: SubtreeUpdateProver;
  subgraphEndpoint: string;

  insertionLog: TreeInsertionLog;

  fillBatchTimeout: NodeJS.Timeout | undefined;
  fillBatchLatency: number | undefined;
  metrics: SubtreeUpdaterMetrics;

  constructor(
    handlerContract: Handler,
    txSubmitter: TxSubmitter,
    logger: Logger,
    redis: IORedis,
    prover: SubtreeUpdateProver,
    subgraphEndpoint: string,
    opts?: SubtreeUpdaterOpts
  ) {
    this.handlerContract = handlerContract;
    this.txSubmitter = txSubmitter;
    this.logger = logger;
    this.prover = prover;
    this.subgraphEndpoint = subgraphEndpoint;

    this.fillBatchLatency = opts?.fillBatchLatency;
    this.fillBatchTimeout = undefined;

    this.handlerMutex = new Mutex();
    this.redis = redis;

    // TODO make this a redis KV store
    this.tree = new SparseMerkleProver();

    const meter = ot.metrics.getMeter(COMPONENT_NAME);
    const createCounter = makeCreateCounterFn(
      meter,
      ACTOR_NAME,
      COMPONENT_NAME
    );

    this.insertionLog = new TreeInsertionLog(
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
      endMerkleIndex: latestCommittedMerkleIndex + 1,
      // we want to ensure we get all of the insertions up to `endId` even if insertion writer is behind,
      // se we set `terminateOnEmpty` to `false so we block until we get all of the committed insertions
      terminateOnEmpty: false,
    });

    for await (const insertions of previousInsertions.iter) {
      logger.debug(`recovering batch of ${insertions.length} insertions`);
      const includes = new Array(insertions.length).fill(false);
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
      await fetchLatestCommittedMerkleIndex(
        this.subgraphEndpoint,
        undefined,
        logger
      );

    if (latestCommittedMerkleIndexAtStart !== undefined) {
      // recover in-memory tree from insertion log up to and including the latest committed subtree
      await this.recoverTree(
        this.logger.child({ function: "recoverTree" }),
        latestCommittedMerkleIndexAtStart
      );
    }

    // construct infinite iterator over all new and future insertions from the log
    logger.info(
      `scanning over insertion log starting from merkle index ${latestCommittedMerkleIndexAtStart}`
    );
    const allInsertions = ClosableAsyncIterator.flatten(
      this.insertionLog.scan({
        // if `undefined`, will start at the beginning
        // note: the `+ 1` is missing because the iterator lower bound is exclusive
        startMerkleIndex: latestCommittedMerkleIndexAtStart,
        terminateOnEmpty: false,
      })
    );

    const proofInputInfos = allInsertions
      // metrics
      .tap((insertion) => {
        logger.info(`got insertion at merkleIndex ${insertion.merkleIndex}`, {
          insertion,
        });

        const noteOrCommitment = NoteTrait.isCommitment(insertion)
          ? "commitment"
          : "note";

        this.metrics.insertionsReceivedCounter.add(1, { noteOrCommitment });
      })
      // update fill batch timer if necessary
      .tap(({ merkleIndex }) => {
        this.updateFillBatchTimer(merkleIndex);
      })
      // make batches
      .batches(BATCH_SIZE, true)
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
      const txHash = await retry(
        async () =>
          await this.handlerMutex.runExclusive(async () => {
            logger.info(
              `pre-dispatch attempting tx submission. subtreeIndex: ${subtreeIndex}`
            );
            const estimatedGas = (
              await this.handlerContract.estimateGas.applySubtreeUpdate(
                newRoot,
                solidityProof,
                {
                  from: await this.txSubmitter.address(),
                }
              )
            ).toBigInt();

            const data = this.handlerContract.interface.encodeFunctionData(
              "applySubtreeUpdate",
              [newRoot, solidityProof]
            );
            const txHash = await this.txSubmitter.submitTransaction(
              {
                to: this.handlerContract.address,
                data,
              },
              {
                gasLimit: Number((estimatedGas * 3n) / 2n),
                logger,
              }
            );

            logger.info(
              `confirmed applySubtreeUpdate tx. subtreeIndex: ${subtreeIndex}. txhash: ${txHash}`
            );
            return txHash;
          }),
        { retries: 3 }
      );

      logger.info("subtree update tx receipt:", { txHash, subtreeIndex });
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
  private updateFillBatchTimer(newInsertionMerkleIndex: number): void {
    if (!this.fillBatchLatency) {
      return;
    }

    // if the insertion we got "completes" a batch, clear the timeout
    // otherwise, if the insertion we got is the first insertion of a new batch, start a timer
    if (
      this.fillBatchTimeout &&
      (newInsertionMerkleIndex + 1) % BATCH_SIZE === 0
    ) {
      clearTimeout(this.fillBatchTimeout);
    } else if (newInsertionMerkleIndex % BATCH_SIZE === 0) {
      this.logger.info(`scheduling fill batch in ${this.fillBatchLatency}ms`);
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
        const estimatedGas = (
          await this.handlerContract.estimateGas.fillBatchWithZeros({
            from: await this.txSubmitter.address(),
          })
        ).toBigInt();

        const data =
          this.handlerContract.interface.encodeFunctionData(
            "fillBatchWithZeros"
          );
        const txHash = await this.txSubmitter.submitTransaction(
          {
            to: this.handlerContract.address,
            data,
          },
          { gasLimit: Number((estimatedGas * 15n) / 10n), logger }
        );
        logger.info("confirmed fillbatch tx", { txHash });
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
