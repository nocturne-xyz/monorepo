import {
  BaseProof,
  BinaryPoseidonTree,
  SubtreeUpdateProver,
  fetchInsertions,
  fetchSubtreeUpdateCommits,
  Note,
  NoteTrait,
  subtreeUpdateInputsFromBatch,
} from "@nocturne-xyz/sdk";
import { RootDatabase, Database } from "lmdb";
import { Wallet } from "@nocturne-xyz/contracts";
import { SubtreeUpdateSubmitter, SyncSubtreeSubmitter } from "./submitter";
import * as JSON from "bigint-json-serialization";

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
  private walletContract: Wallet;
  private db: Database<string, string>;
  private prover: SubtreeUpdateProver;
  private submitter: SubtreeUpdateSubmitter;

  private insertions: (Note | bigint)[];
  private batches: SubtreeUpdateBatch[];
  private tree: BinaryPoseidonTree;

  constructor(
    walletContract: Wallet,
    rootDB: RootDatabase,
    prover: SubtreeUpdateProver,
    submitter: SubtreeUpdateSubmitter = new SyncSubtreeSubmitter(walletContract)
  ) {
    this.walletContract = walletContract;
    this.db = rootDB.openDB<string, string>({ name: "insertions" });
    this.prover = prover;

    this.insertions = [];
    this.batches = [];
    this.tree = new BinaryPoseidonTree();

    this.submitter = submitter;
  }

  public async init(): Promise<void> {
    await this.recoverPersisedState();
  }

  public async tryGenAndSubmitProofs(): Promise<void> {
    for (const { batch, newRoot, subtreeIndex } of this.batches) {
      const proof = await this.genProof(batch, subtreeIndex);
      await this.submitter.submitProof(proof, newRoot, subtreeIndex);
    }
  }

  // return true if at least one batch was filled
  public async pollInsertionsAndTryMakeBatch(): Promise<boolean> {
    const currentBlockNumber =
      await this.walletContract.provider.getBlockNumber();
    const nextBlockToIndex = await this.getNextBlockToIndex();
    if (nextBlockToIndex > currentBlockNumber) {
      return false;
    }

    const [newInsertions, newCommits] = await Promise.all([
      fetchInsertions(
        this.walletContract,
        nextBlockToIndex,
        currentBlockNumber
      ),
      fetchSubtreeUpdateCommits(
        this.walletContract,
        nextBlockToIndex,
        currentBlockNumber
      ),
    ]);

    console.log("fetched", newInsertions.length, "new insertions");

    const lastCommit =
      newCommits.length > 0 ? newCommits[newCommits.length - 1] : undefined;

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

    this.insertions.push(...newInsertions);
    if (lastCommit !== undefined) {
      this.pruneBatchesUpTo(lastCommit.subtreeIndex);
    }

    return await this.tryMakeBatches();
  }

  public async dropDB(): Promise<void> {
    await this.submitter.dropDB();
    await this.db.drop();
  }

  private async subtreeIsCommitted(subtreeIndex: number): Promise<boolean> {
    const lastCommitedIndex = await this.getLastCommittedIndex();
    return lastCommitedIndex !== undefined && subtreeIndex <= lastCommitedIndex;
  }

  private async tryMakeBatches(): Promise<boolean> {
    let madeBatch = false;
    while (this.insertions.length >= BinaryPoseidonTree.BATCH_SIZE) {
      const batch = this.insertions.slice(0, BinaryPoseidonTree.BATCH_SIZE);
      this.applyBatch(batch);

      const subtreeIndex = this.tree.count - batch.length;
      const newRoot = this.tree.root();

      if (!(await this.subtreeIsCommitted(subtreeIndex))) {
        this.batches.push({
          batch,
          newRoot,
          subtreeIndex,
        });
      }

      this.insertions.splice(0, BinaryPoseidonTree.BATCH_SIZE);
      madeBatch = true;
    }

    return madeBatch;
  }

  private async getNextBlockToIndex(): Promise<number> {
    const nextBlockToIndexStr =
      (await this.db.get(NEXT_BLOCK_TO_INDEX_KEY)) ?? "0";
    return parseInt(nextBlockToIndexStr);
  }

  private async getNextInsertionIndex(): Promise<number> {
    const indexStr = (await this.db.get(NEXT_INSERTION_INDEX_KEY)) ?? "0";
    return parseInt(indexStr);
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
    const merkleProof = this.tree.getProof(subtreeIndex);
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

  private static parseInsertion(value: string): Note | bigint {
    const insertion = JSON.parse(value);
    if (typeof insertion === "bigint") {
      // it's a commitment
      return insertion;
    } else if (typeof insertion === "object") {
      // it's a note - push the object as-is
      return insertion as Note;
    } else {
      // TODO: can remove this once DB wrapper is added
      throw new Error("invalid insertion type read from DB");
    }
  }

  private async recoverPersisedState(): Promise<void> {
    const nextInsertionIndex = await this.getNextInsertionIndex();
    const lastCommitedIndex = (await this.getLastCommittedIndex()) ?? 0;
    if (nextInsertionIndex === 0) {
      return;
    }

    const start = insertionKey(lastCommitedIndex);
    const end = insertionKey(nextInsertionIndex);

    for (const { key, value } of this.db.getRange({ start, end })) {
      if (value === undefined) {
        throw new Error(`DB entry not found: ${key}`);
      }

      const insertion = SubtreeUpdater.parseInsertion(value);
      this.insertions.push(insertion);
    }

    await this.tryMakeBatches();
  }
}
