import { BaseProof, BinaryPoseidonTree, packToSolidityProof, SubtreeUpdateProver, toJSON } from "@nocturne-xyz/sdk";
import { RootDatabase, Database } from 'lmdb';
import { Wallet } from "@nocturne-xyz/contracts";
import { subtreeUpdateInputsFromBatch } from "@nocturne-xyz/local-prover";
import { NoteTrait, Note } from "@nocturne-xyz/sdk";
import { fetchInsertions } from "@nocturne-xyz/sdk";

export { SubtreeUpdateServer } from "./server";


const NEXT_BLOCK_TO_INDEX_KEY = "NEXT_BLOCK_TO_INDEX";
const NEXT_INSERTION_INDEX_KEY = "NEXT_INSERTION_INDEX";
const INSERTION_PREFIX = "TREE_INSERTION";

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
  return `${INSERTION_PREFIX}-${numberToStringPadded(idx, 64)}`;
}

function commitKey(batchIdx: number) {
  // make the keys lexicographically ordered so that we can iterate over them
  return `${INSERTION_PREFIX}-COMMIT-${numberToStringPadded(batchIdx, 64)}`;
}

export interface UpdaterParams {
  walletContract: Wallet;
  rootDB: RootDatabase,
}

export interface SubtreeUpdateSubmitter {
  subtreeIsCommitted: (subtreeIndex: number, newRoot: bigint) => Promise<boolean>;
  submitProof: (proof: BaseProof, newRoot: bigint, subtreeIndex: number) => Promise<void>;
  dropDB: () => Promise<void>;
}

// Default implementation of `SubtreeUpdateSubmitter` that just sits there and waits
// for the TX to confirm.
export class SyncSubtreeSubmitter implements SubtreeUpdateSubmitter {
  walletContract: Wallet;
  db: Database<string, string>;

  constructor(walletContract: Wallet, rootDB: RootDatabase) {
    this.walletContract = walletContract;
    this.db = rootDB.openDB<string, string>({ name: "comitted-batches" });
  }

  async subtreeIsCommitted(subtreeIndex: number, newRoot: bigint): Promise<boolean> {
    const isCommitted = await this.db.get(commitKey(subtreeIndex));
    if (isCommitted === "true") {
      return true;
    }

    return await this.walletContract.pastRoots(newRoot);
  }

  async submitProof(proof: BaseProof, newRoot: bigint, subtreeIndex: number): Promise<void> {
    const solidityProof = packToSolidityProof(proof);
    const tx = await this.walletContract.applySubtreeUpdate(newRoot, solidityProof);

    try {
      await tx.wait();
      await this.db.put(commitKey(subtreeIndex), "true");
    } catch (err: any) {
      if (err.toString().includes("newRoot already a past root")) {
        await this.db.put(commitKey(subtreeIndex), "true");
      } else {
        throw err;
      }
    }
  }

  async dropDB(): Promise<void> {
    await this.db.drop();
  }
}

export class SubtreeUpdater {
  private walletContract: Wallet;
  private db: Database<string, string>;
  private prover: SubtreeUpdateProver;
  private submitter: SubtreeUpdateSubmitter;

  private insertions: (Note | bigint)[];
  private tree: BinaryPoseidonTree;
  private nextBlockToIndex?: number;
  private index?: number;

  constructor(walletContract: Wallet, rootDB: RootDatabase, prover: SubtreeUpdateProver, submitter: SubtreeUpdateSubmitter = new SyncSubtreeSubmitter(walletContract, rootDB)) {
    this.walletContract = walletContract;
    this.db = rootDB.openDB<string, string>({ name: "insertions" });
    this.prover = prover;

    this.insertions = [];
    this.tree = new BinaryPoseidonTree();
    this.nextBlockToIndex = undefined;
    this.index = undefined;

    this.submitter = submitter;
  }

  public async init(): Promise<void> {
    this.index = await this.getNextInsertionIndex();
    this.nextBlockToIndex = await this.getNextBlockToIndex();
    await this.recoverPersisedState();
  }

  // return true if at least one batch was filled 
  public async pollInsertions(): Promise<boolean> {
    const currentBlockNumber = await this.walletContract.provider.getBlockNumber();
    const nextBlockToIndex = await this.getNextBlockToIndex();
    if (nextBlockToIndex > currentBlockNumber) {
      return false;
    }

    const newInsertions = await fetchInsertions(this.walletContract, nextBlockToIndex, currentBlockNumber);

    const index = await this.getNextInsertionIndex();
    await this.db.transaction(
      () => {
        let keyIndex = index;
        for (const insertion of newInsertions) {
          this.db.put(insertionKey(keyIndex), toJSON(insertion));
          keyIndex += 1;
        }
        this.db.put(NEXT_INSERTION_INDEX_KEY, (index + newInsertions.length).toString());
        this.db.put(NEXT_BLOCK_TO_INDEX_KEY, (currentBlockNumber + 1).toString());
      }
    );

    this.insertions.push(...newInsertions);
    this.nextBlockToIndex = currentBlockNumber + 1;
    this.index = (this.index ?? 0) + newInsertions.length;
    
    return await this.tryGenAndSubmitProof();
  }

  public async fillBatch(): Promise<void> {
    await this.walletContract.fillBatchWithZeros();
  }

  public async dropDB(): Promise<void> {
    await this.submitter.dropDB();
    await this.db.drop();
  }

  private async getNextBlockToIndex(): Promise<number> {
    if (this.nextBlockToIndex === undefined) {
      const nextBlockToIndexStr = (await this.db.get(NEXT_BLOCK_TO_INDEX_KEY)) ?? "0";
      this.nextBlockToIndex = parseInt(nextBlockToIndexStr);
    }

    return this.nextBlockToIndex;
  }

  private async getNextInsertionIndex(): Promise<number> {
    if (this.index === undefined) {
      const indexStrs = (await this.db.get(NEXT_INSERTION_INDEX_KEY)) ?? "0";
      this.index = parseInt(indexStrs);
    }

    return this.index;
  }

  private async genProof(batch: (Note | bigint)[], subtreeIndex: number): Promise<BaseProof> {
    const merkleProof = this.tree.getProof(subtreeIndex);
    const inputs = subtreeUpdateInputsFromBatch(batch, merkleProof);
    const { proof } = await this.prover.proveSubtreeUpdate(inputs);
    return proof;
  }

  private async shouldGenProof(subtreeIndex: number, newRoot: bigint): Promise<boolean> {
      return !(await this.submitter.subtreeIsCommitted(subtreeIndex, newRoot));
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

  // returns true if at least one batch was filled 
  private async tryGenAndSubmitProof(): Promise<boolean> {
    let filledBatch = false;
    while (this.insertions.length >= BinaryPoseidonTree.BATCH_SIZE) {
      const batch = this.insertions.slice(0, BinaryPoseidonTree.BATCH_SIZE);
      this.applyBatch(batch);

      // only generate / submit proof if the batch is not already committed
      const subtreeIndex = this.tree.count - batch.length;
      if (await this.shouldGenProof(subtreeIndex, this.tree.root())) {
        const proof = await this.genProof(batch, subtreeIndex);
        await this.submitter.submitProof(proof, this.tree.root(), subtreeIndex);
      }

      this.insertions.splice(0, BinaryPoseidonTree.BATCH_SIZE);
      filledBatch = true;
    }

    return filledBatch;
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

      const insertion = JSON.parse(value);
      if (typeof insertion === "string") {
        // it's a commitment - turn into a bigint
        this.insertions.push(BigInt(insertion));
      } else if (typeof insertion === "object") {
        // it's a note - push the object as-is
        this.insertions.push(NoteTrait.fromJSON(insertion));
      } else {
        // TODO: can remove this once DB wrapper is added
        throw new Error("invalid insertion type read from DB");
      }

      if (this.insertions.length === BinaryPoseidonTree.BATCH_SIZE) {
        const batch = this.insertions.slice(0, BinaryPoseidonTree.BATCH_SIZE);
        this.applyBatch(batch);

        const subtreeIndex = this.tree.count - batch.length;
        if (await this.submitter.subtreeIsCommitted(subtreeIndex, this.tree.root())) {
          this.insertions.splice(0, BinaryPoseidonTree.BATCH_SIZE);
        }
      }
    }
  }
}
