import {
  BaseProof,
  BinaryPoseidonTree,
  packToSolidityProof,
  SubtreeUpdateProver,
  toJSON,
  fetchInsertions,
  fetchSubtreeUpdateCommits,
  Note,
  NoteTrait,
} from "@nocturne-xyz/sdk";
import { RootDatabase, Database } from 'lmdb';
import { Wallet } from "@nocturne-xyz/contracts";
import { subtreeUpdateInputsFromBatch } from "@nocturne-xyz/local-prover";

export { SubtreeUpdateServer } from "./server";

const NEXT_BLOCK_TO_INDEX_KEY = "NEXT_BLOCK_TO_INDEX";
const NEXT_INSERTION_INDEX_KEY = "NEXT_INSERTION_INDEX";
const INSERTION_PREFIX = "TREE_INSERTION_";
const COMMIT_PREFIX = "COMMIT_";

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

function commitKey(batchIdx: number) {
  // make the keys lexicographically ordered so that we can iterate over them
  return `${COMMIT_PREFIX}${numberToStringPadded(batchIdx, 64)}`;
}

export interface UpdaterParams {
  walletContract: Wallet;
  rootDB: RootDatabase,
}

export interface SubtreeUpdateSubmitter {
  submitProof (proof: BaseProof, newRoot: bigint, subtreeIndex: number): Promise<void>;
  dropDB(): Promise<void>;
}

// Default implementation of `SubtreeUpdateSubmitter` that just sits there and waits
// for the TX to confirm.
export class SyncSubtreeSubmitter implements SubtreeUpdateSubmitter {
  walletContract: Wallet;

  constructor(walletContract: Wallet) {
    this.walletContract = walletContract;
  }

  async submitProof(proof: BaseProof, newRoot: bigint): Promise<void> {
    const solidityProof = packToSolidityProof(proof);
    try {
      const tx = await this.walletContract.applySubtreeUpdate(newRoot, solidityProof); 
      await tx.wait();
    } catch (err: any) {

      // ignore errors that are due to duplicate submissions
      // this can happen if there are multiple instances of subtree updaters running
      if (!err.toString().includes("newRoot already a past root")) {
        throw err;
      }
    }
  }

  async dropDB(): Promise<void> {}
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

  constructor(walletContract: Wallet, rootDB: RootDatabase, prover: SubtreeUpdateProver, submitter: SubtreeUpdateSubmitter = new SyncSubtreeSubmitter(walletContract)) {
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
      if (await this.shouldGenProof(subtreeIndex, newRoot)) {
        const proof = await this.genProof(batch, subtreeIndex);
        await this.submitter.submitProof(proof, newRoot, subtreeIndex);
      }
    }

    this.batches = [];
  }

  // return true if at least one batch was filled 
  public async pollInsertions(): Promise<boolean> {
    const currentBlockNumber = await this.walletContract.provider.getBlockNumber();
    const nextBlockToIndex = await this.getNextBlockToIndex();
    if (nextBlockToIndex > currentBlockNumber) {
      return false;
    }

    const [newInsertions, newCommits] = await Promise.all([
      fetchInsertions(this.walletContract, nextBlockToIndex, currentBlockNumber),
      fetchSubtreeUpdateCommits(this.walletContract, nextBlockToIndex, currentBlockNumber),
    ]);

    const index = await this.getNextInsertionIndex();
    await this.db.transaction(
      () => {
        let keyIndex = index;
        for (const insertion of newInsertions) {
          this.db.put(insertionKey(keyIndex), toJSON(insertion));
          keyIndex += 1;
        }

        for (const { subtreeIndex } of newCommits) {
          this.db.put(commitKey(subtreeIndex), "true");
        }

        this.db.put(NEXT_INSERTION_INDEX_KEY, (index + newInsertions.length).toString());
        this.db.put(NEXT_BLOCK_TO_INDEX_KEY, (currentBlockNumber + 1).toString());
      }
    );

    this.insertions.push(...newInsertions);

    const filledBatch = this.insertions.length >= BinaryPoseidonTree.BATCH_SIZE;
    this.tryMakeBatches();

    return filledBatch;
  }

  public async dropDB(): Promise<void> {
    await this.submitter.dropDB();
    await this.db.drop();
  }

  private async subtreeIsCommitted(subtreeIndex: number): Promise<boolean> {
    return await this.db.get(commitKey(subtreeIndex)) === "true";
  }

  private tryMakeBatches(): boolean {
    let madeBatch = false;
    while (this.insertions.length >= BinaryPoseidonTree.BATCH_SIZE) {
      const batch = this.insertions.slice(0, BinaryPoseidonTree.BATCH_SIZE);
      this.applyBatch(batch);

      const subtreeIndex = this.tree.count - batch.length;
      const newRoot = this.tree.root();
      this.batches.push({
        batch,
        newRoot,
        subtreeIndex,
      });

      this.insertions.splice(0, BinaryPoseidonTree.BATCH_SIZE);
      madeBatch = true;
    }

    return madeBatch;
  }

  private async getNextBlockToIndex(): Promise<number> {
    const nextBlockToIndexStr = (await this.db.get(NEXT_BLOCK_TO_INDEX_KEY)) ?? "0";
    return parseInt(nextBlockToIndexStr);
  }

  private async getNextInsertionIndex(): Promise<number> {
    const indexStrs = (await this.db.get(NEXT_INSERTION_INDEX_KEY)) ?? "0";
    return parseInt(indexStrs);
  }

  private async genProof(batch: (Note | bigint)[], subtreeIndex: number): Promise<BaseProof> {
    const merkleProof = this.tree.getProof(subtreeIndex);
    const inputs = subtreeUpdateInputsFromBatch(batch, merkleProof);
    const { proof } = await this.prover.proveSubtreeUpdate(inputs);
    return proof;
  }

  private async shouldGenProof(subtreeIndex: number, newRoot: bigint): Promise<boolean> {
    const isCommittedLocally = await this.subtreeIsCommitted(subtreeIndex);

    if (isCommittedLocally) {
      return false;
    }

    return !(await this.walletContract.pastRoots(newRoot));
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

  private static parseInsertion(value: string): Note | bigint {
      const insertion = JSON.parse(value);
      if (typeof insertion === "string") {
        // it's a commitment - turn into a bigint
        return BigInt(insertion);
      } else if (typeof insertion === "object") {
        // it's a note - push the object as-is
        return NoteTrait.fromJSON(insertion);
      } else {
        // TODO: can remove this once DB wrapper is added
        throw new Error("invalid insertion type read from DB");
      }
  }

  private async recoverPersisedState(): Promise<void> {
    const nextInsertionIndex = await this.getNextInsertionIndex();
    if (nextInsertionIndex === 0) {
      return;
    }

    const start = insertionKey(0);
    const end = insertionKey(nextInsertionIndex);

    for (const { key, value } of this.db.getRange({ start, end })) {
      if (value === undefined) {
        throw new Error(`DB entry not found: ${key}`);
      }

      const insertion = SubtreeUpdater.parseInsertion(value);
      this.insertions.push(insertion);
      this.tryMakeBatches();

      for (const { subtreeIndex } of this.batches) {
        if (await this.subtreeIsCommitted(subtreeIndex)) {
          this.batches.shift();
        }
      }
    }
  }
}
