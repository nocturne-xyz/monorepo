import {
  BaseProof,
  SubtreeUpdateProver,
  fetchInsertions,
  fetchSubtreeUpdateCommits,
  Note,
  NoteTrait,
  subtreeUpdateInputsFromBatch,
  TreeConstants,
} from "@nocturne-xyz/sdk";
import { poseidonBN } from "@nocturne-xyz/circuit-utils";
import { RootDatabase, Database } from "lmdb";
import { Handler } from "@nocturne-xyz/contracts";
import { SubtreeUpdateSubmitter } from "./submitter";
import * as JSON from "bigint-json-serialization";
import { Logger } from "winston";
import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";

export { SubtreeUpdateServer } from "./server";
export { RapidsnarkSubtreeUpdateProver } from "./rapidsnarkProver";

const NEXT_BLOCK_TO_INDEX_KEY = "NEXT_BLOCK_TO_INDEX";
const NEXT_INSERTION_INDEX_KEY = "NEXT_INSERTION_INDEX";
const INSERTION_PREFIX = "TREE_INSERTION_";
const LAST_COMMITTED_INDEX_KEY = "LAST_COMMITTED_INDEX";

function numberToStringPadded(num: number, targetLen: number): string {
  let res = num.toString();
  if (res.length > targetLen) {
    throw new Error(`number ${num} is too large to fit in ${targetLen} digits`);
  } else if (res.length < targetLen) {
    res = "0".repeat(targetLen - res.length) + res;
  }

  return res;
}

function insertionKey(idx: number) {
  // make the keys lexicographically ordered so that we can iterate over them
  return `${INSERTION_PREFIX}${numberToStringPadded(idx, 64)}`;
}

interface SubtreeUpdateBatch {
  batch: (Note | bigint)[];
  newRoot: bigint;
  subtreeIndex: number;
}

export class SubtreeUpdater {
  private handlerContract: Handler;
  private db: Database<string, string>;
  private prover: SubtreeUpdateProver;
  private submitter: SubtreeUpdateSubmitter;

  private insertions: (Note | bigint)[];
  private batches: SubtreeUpdateBatch[];
  private tree: IncrementalMerkleTree;
  indexingStartBlock: number;

  constructor(
    handlerContract: Handler,
    rootDB: RootDatabase,
    prover: SubtreeUpdateProver,
    submitter: SubtreeUpdateSubmitter,
    indexingStartBlock = 0
  ) {
    this.handlerContract = handlerContract;
    this.db = rootDB.openDB<string, string>({ name: "insertions" });
    this.prover = prover;

    this.insertions = [];
    this.batches = [];
    this.tree = new IncrementalMerkleTree(
      poseidonBN,
      TreeConstants.DEPTH,
      0n,
      4
    );

    this.submitter = submitter;

    this.indexingStartBlock = indexingStartBlock;
  }

  public async init(logger: Logger): Promise<void> {
    await this.recoverPersisedState(logger);

    const nextBlockToIndex = await this.getNextBlockToIndex();
    logger.info(
      "subtree updater initialized - starting at block",
      nextBlockToIndex
    );
  }

  public async tryGenAndSubmitProofs(logger: Logger): Promise<void> {
    logger.debug("generating and submitting proofs for queued batches");
    for (const { batch, newRoot, subtreeIndex } of this.batches) {
      const childLogger = logger.child({ subtreeIndex, batch, newRoot });
      childLogger.info("generating proof for batch...");

      const proof = await this.genProof(batch, subtreeIndex);
      childLogger.info("proof generated. submitting...");
      await this.submitter.submitProof(childLogger, proof, newRoot);
    }
  }

  // return true if at least one batch was filled
  public async pollInsertionsAndTryMakeBatch(logger: Logger): Promise<boolean> {
    const currentBlockNumber =
      await this.handlerContract.provider.getBlockNumber();
    const nextBlockToIndex = await this.getNextBlockToIndex();
    if (nextBlockToIndex > currentBlockNumber) {
      return false;
    }

    logger.info(
      `polling insertions from ${nextBlockToIndex} to ${currentBlockNumber}`
    );
    logger = logger.child({
      rangeStart: nextBlockToIndex,
      rangeEnd: currentBlockNumber,
    });

    const [newInsertions, newCommits] = await Promise.all([
      fetchInsertions(
        this.handlerContract,
        nextBlockToIndex,
        currentBlockNumber
      ),
      fetchSubtreeUpdateCommits(
        this.handlerContract,
        nextBlockToIndex,
        currentBlockNumber
      ),
    ]);

    logger.info("fetched", newInsertions.length, "new insertions");

    const lastCommit =
      newCommits.length > 0 ? newCommits[newCommits.length - 1] : undefined;

    /* eslint-disable @typescript-eslint/no-floating-promises */
    const index = await this.getNextInsertionIndex();
    await this.db.transaction(() => {
      let keyIndex = index;
      for (const insertion of newInsertions) {
        this.db.put(insertionKey(keyIndex), JSON.stringify(insertion));
        keyIndex += 1;
      }

      if (lastCommit !== undefined) {
        this.db.put(
          LAST_COMMITTED_INDEX_KEY,
          lastCommit.subtreeIndex.toString()
        );
      }

      this.db.put(
        NEXT_INSERTION_INDEX_KEY,
        (index + newInsertions.length).toString()
      );
      this.db.put(NEXT_BLOCK_TO_INDEX_KEY, (currentBlockNumber + 1).toString());
    });
    /* eslint-enable @typescript-eslint/no-floating-promises */

    this.insertions.push(...newInsertions);
    if (lastCommit !== undefined) {
      logger.info(
        "pruning batches up to subtreeIndex",
        lastCommit.subtreeIndex
      );
      this.pruneBatchesUpTo(lastCommit.subtreeIndex);
    }

    return await this.tryMakeBatches(logger);
  }

  public async fillBatch(): Promise<void> {
    await this.submitter.fillBatch();
  }

  public async dropDB(): Promise<void> {
    await this.submitter.dropDB();
    await this.db.drop();
  }

  public batchNotEmptyOrFull(): boolean {
    return this.insertions.length % TreeConstants.BATCH_SIZE !== 0;
  }

  private async subtreeIsCommitted(subtreeIndex: number): Promise<boolean> {
    const lastCommitedIndex = await this.getLastCommittedIndex();
    return lastCommitedIndex !== undefined && subtreeIndex <= lastCommitedIndex;
  }

  private async tryMakeBatches(logger: Logger): Promise<boolean> {
    let madeBatch = false;
    while (this.insertions.length >= TreeConstants.BATCH_SIZE) {
      const batch = this.insertions.slice(0, TreeConstants.BATCH_SIZE);
      logger.info("making batch", batch);

      this.applyBatch(batch);

      const subtreeIndex = this.tree.leaves.length - batch.length;
      const newRoot = this.tree.root;

      if (!(await this.subtreeIsCommitted(subtreeIndex))) {
        this.batches.push({
          batch,
          newRoot,
          subtreeIndex,
        });
      }

      this.insertions.splice(0, TreeConstants.BATCH_SIZE);
      madeBatch = true;
    }

    return madeBatch;
  }

  // TODO: replace plain DB with new put/get numbers in KvDB
  private async getNextBlockToIndex(): Promise<number> {
    const nextBlockToIndexStr = await this.db.get(NEXT_BLOCK_TO_INDEX_KEY);
    return nextBlockToIndexStr
      ? parseInt(nextBlockToIndexStr)
      : this.indexingStartBlock;
  }

  private async getNextInsertionIndex(): Promise<number> {
    const indexStr = await this.db.get(NEXT_INSERTION_INDEX_KEY);
    return indexStr ? parseInt(indexStr) : this.indexingStartBlock;
  }

  private async getLastCommittedIndex(): Promise<number | undefined> {
    const lastCommittedIndexStr = await this.db.get(LAST_COMMITTED_INDEX_KEY);
    if (lastCommittedIndexStr === undefined) {
      return undefined;
    }

    return parseInt(lastCommittedIndexStr);
  }

  private async genProof(
    batch: (Note | bigint)[],
    subtreeIndex: number
  ): Promise<BaseProof> {
    const merkleProof = this.tree.createProof(subtreeIndex);
    const inputs = subtreeUpdateInputsFromBatch(batch, merkleProof);
    const { proof } = await this.prover.proveSubtreeUpdate(inputs);
    return proof;
  }

  private applyBatch(batch: (Note | bigint)[]): void {
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      if (typeof item === "bigint") {
        this.tree.insert(item);
      } else {
        this.tree.insert(NoteTrait.toCommitment(item));
      }
    }
  }

  private pruneBatchesUpTo(upToSubtreeIndex: number) {
    this.batches = this.batches.filter(
      ({ subtreeIndex }) => subtreeIndex > upToSubtreeIndex
    );
  }

  private static parseInsertion(logger: Logger, value: string): Note | bigint {
    const insertion = JSON.parse(value);
    if (typeof insertion === "bigint") {
      // it's a commitment
      return insertion;
    } else if (typeof insertion === "object") {
      // it's a note - push the object as-is
      return insertion as Note;
    } else {
      // TODO: can remove this once DB wrapper is added
      const msg = `invalid insertion type read from DB: ${insertion}`;
      logger.error(msg);
      throw new Error(msg);
    }
  }

  private async recoverPersisedState(logger: Logger): Promise<void> {
    const nextInsertionIndex = await this.getNextInsertionIndex();
    if (nextInsertionIndex === 0) {
      return;
    }

    const start = insertionKey(0);
    const end = insertionKey(nextInsertionIndex);

    for (const { key, value } of this.db.getRange({ start, end })) {
      if (value === undefined) {
        const msg = `DB entry not found: ${key}`;
        logger.error(msg);
        throw new Error(msg);
      }

      const insertion = SubtreeUpdater.parseInsertion(logger, value);
      this.insertions.push(insertion);
    }

    await this.tryMakeBatches(logger);
  }
}
