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
  TotalEntityIndex,
  merkleIndexToSubtreeIndex,
  BaseProof,
  SubtreeUpdateInputs,
} from "@nocturne-xyz/sdk";
import IORedis from "ioredis";
import { Handler } from "@nocturne-xyz/contracts";
import { ActorHandle, makeCreateCounterFn } from "@nocturne-xyz/offchain-utils";
import * as ot from "@opentelemetry/api";
import { Insertion } from "./sync/syncAdapter";
import { PersistentLog } from "./persistentLog";
import * as txManager from "@nocturne-xyz/tx-manager";
import { Mutex } from "async-mutex";
import { ACTOR_NAME, COMPONENT_NAME } from "./constants";

const { BATCH_SIZE } = TreeConstants;
const RECOVERY_BATCH_SIZE = BATCH_SIZE * 16;
const RECOVER_INCLUDE_ARRAY = [
  true,
  ...range(RECOVERY_BATCH_SIZE - 1).map(() => false),
];

const SUBTREE_INCLUDE_ARRAY = [true, ...range(BATCH_SIZE - 1).map(() => false)];

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
  adapter: SubtreeUpdaterSyncAdapter;
  logger: Logger;

  redis: IORedis;
  tree: SparseMerkleProver;
  prover: SubtreeUpdateProver;

  insertionLog: PersistentLog<Insertion>;

  fillBatchTimeout: NodeJS.Timeout | undefined;
  fillBatchLatency: number | undefined;
  metrics: SubtreeUpdaterMetrics;

  constructor(
    handlerContract: Handler,
    syncAdapter: SubtreeUpdaterSyncAdapter,
    logger: Logger,
    redis: IORedis,
    prover: SubtreeUpdateProver,
    opts?: SubtreeUpdaterOpts
  ) {
    this.handlerContract = handlerContract;
    this.adapter = syncAdapter;
    this.logger = logger;
    this.prover = prover;

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
      logger.child({ function: "PersistentLog" })
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

  async recoverTree(logger: Logger): Promise<TotalEntityIndex | undefined> {
    if (this.tree.count() > 0) {
      throw new Error("canont recover non-empty tree");
    }

    logger.info("recovering tree from fresh state");
    const previousInsertions = ClosableAsyncIterator.flatten(
      this.insertionLog.scan()
    ).batches(RECOVERY_BATCH_SIZE, true);

    let endTEI = undefined;
    for await (const wrappedInsertions of previousInsertions.iter) {
      endTEI = wrappedInsertions[wrappedInsertions.length - 1].totalEntityIndex;
      const insertions = wrappedInsertions.map(({ inner }) => inner);
      const { leaves, subtreeBatchOffset } =
        batchInfoFromInsertions(insertions);

      this.tree.insertBatch(subtreeBatchOffset, leaves, RECOVER_INCLUDE_ARRAY);
      logger.debug(`recovered up to merkleIndex ${this.tree.count() - 1}`);
    }

    return endTEI;
  }

  async start(queryThrottleMs?: number): Promise<ActorHandle> {
    const logger = this.logger.child({ function: "start" });

    // recover tree in-memory from insertion log
    // returns the latest multiple of 256 TEI that was recovered
    const recoveryTEI = await this.recoverTree(
      this.logger.child({ function: "recoverTree" })
    );

    // goal: get an infinite iterator of all proof inputs starting from the point to which we recovered (which must be a multiple of 16)
    // main idea: use two iterators, and chain them together:
    //   (1) iterator over the remaining insertions in the log that we didn't scan over during recovery. That is, insertions with TEI > `recoveryTEI`
    //   (2) iterator over new insertions from the sync adapter that aren't yet in the log.
    //   (3) chain them together and chunk into 16-insertion batches
    //   (4) filter out batches that are already committed and make proof inputs for the rest

    // (1) start the first iterator at `startTEI`, defined as `recoveryTEI + 1` or 0 if the log was empty
    const startTEI = recoveryTEI ? recoveryTEI + 1n : 0n;
    const newInsertionsFromLog = this.insertionLog.scan(startTEI);

    // (2) get latest total entity index from insertion log and start the sync adapter's iterator at the TEI after this one,
    // or 0 if it's undefined
    const latestTEIFromLog =
      await this.insertionLog.getLatestTotalEntityIndex();
    const newInsertionsFromAdapter = this.insertionLog.syncAndPipe(
      this.adapter.iterInsertions(
        latestTEIFromLog ? latestTEIFromLog + 1n : 0n,
        {
          throttleMs: queryThrottleMs,
        }
      )
    );

    // (3) construct iterator of all new 16-insertion batches, and insert them into the tree
    const batches = ClosableAsyncIterator.flatMap(
      newInsertionsFromLog.chain(newInsertionsFromAdapter),
      ({ inner }) => inner
    )
      // log + count insertion
      .tap((insertion) => {
        logger.debug(`got insertion at merkleIndex ${insertion.merkleIndex}`, {
          insertion,
        });

        const noteOrCommitment = NoteTrait.isCommitment(insertion)
          ? "commitment"
          : "note";
        this.metrics.insertionsReceivedCounter.add(1, { noteOrCommitment });
      })
      .tap((insertion) => this.maybeScheduleFillBatch(insertion.merkleIndex))
      .batches(BATCH_SIZE, true)
      .map(batchInfoFromInsertions)
      .tap(({ leaves, subtreeBatchOffset }) =>
        this.tree.insertBatch(subtreeBatchOffset, leaves, SUBTREE_INCLUDE_ARRAY)
      );

    // (4) construct an iterator of proof inputs for uncommitted batches
    const latestCommittedSubtreeIndexAtStart =
      await this.adapter.fetchLatestSubtreeIndex();
    const proofInputInfos: ClosableAsyncIterator<ProofInputData> = batches
      // filterout batches that are already committed
      .filter(
        ({ subtreeBatchOffset }) =>
          !latestCommittedSubtreeIndexAtStart ||
          merkleIndexToSubtreeIndex(subtreeBatchOffset) >
            latestCommittedSubtreeIndexAtStart
      )
      // make proof inputs
      .map(({ batch, subtreeBatchOffset }) => {
        const merkleProof = this.tree.getProof(subtreeBatchOffset);
        const proofInputs = subtreeUpdateInputsFromBatch(batch, merkleProof);

        // logging only
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
      this.logger.debug("teardown completed");
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
        const nonce = await this.handlerContract.signer.getTransactionCount(); // ensure its replacement
        const contractTx = async (gasPrice: number) => {
          const tx = await this.handlerContract.applySubtreeUpdate(
            newRoot,
            solidityProof,
            { gasPrice, nonce }
          );

          logger.info(
            `attempting tx manager submission. subtreIndex: ${subtreeIndex} txhash: ${tx.hash} gas price: ${gasPrice}`
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
