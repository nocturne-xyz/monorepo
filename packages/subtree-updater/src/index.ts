
import { BinaryPoseidonTree, packToSolidityProof, SubtreeUpdateInputs, SubtreeUpdateProver, toJSON } from "@nocturne-xyz/sdk";
import { RootDatabase, Database } from 'lmdb';
import { Wallet } from "@nocturne-xyz/contracts";
import { subtreeUpdateInputsFromBatch } from "@nocturne-xyz/local-prover";
import { NoteTrait, Note } from "@nocturne-xyz/sdk";
import { fetchInsertions } from "@nocturne-xyz/sdk";
import { ContractTransaction } from "ethers";


const NEXT_BLOCK_TO_INDEX_KEY = "NEXT_BLOCK_TO_INDEX";
const NEXT_INSERTION_INDEX_KEY = "NEXT_INSERTION_INDEX";
const INSERTION_PREFIX = "TREE_INSERTION";
const RECOVERY_CHUNK_SIZE = 100 * BinaryPoseidonTree.BATCH_SIZE;

function insertionKey(idx: number) {
  return `${INSERTION_PREFIX}-${idx}`;
}

function commitKey(batchIdx: number) {
  return `${INSERTION_PREFIX}-COMMIT-${batchIdx}`;
}

export interface UpdaterParams {
  walletContract: Wallet;
  rootDB: RootDatabase,
}

// TODO: somehow handle reorgs
export class SubtreeUpdater {
  private walletContract: Wallet;
  private db: Database<string, string>;
  private prover: SubtreeUpdateProver;

  private insertions: (Note | bigint)[];
  private tree: BinaryPoseidonTree;
  private nextBlockToIndex?: number;
  private index?: number;

  constructor(walletContract: Wallet, rootDB: RootDatabase, prover: SubtreeUpdateProver) {
    this.walletContract = walletContract;
    this.db = rootDB.openDB<string, string>({ name: "insertions" });
    this.prover = prover;

    this.insertions = [];
    this.tree = new BinaryPoseidonTree();
    this.nextBlockToIndex = undefined;
    this.index = undefined;
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

  private async genAndSubmitProof(inputs: SubtreeUpdateInputs, newRoot: bigint): Promise<ContractTransaction> {
    const { proof } = await this.prover.proveSubtreeUpdate(inputs);
    const solidityProof = packToSolidityProof(proof);

    return await this.walletContract.applySubtreeUpdate(newRoot, solidityProof);
  }

  private async shouldGenProof(subtreeIndex: number, newRoot: bigint): Promise<boolean> {
      const isCommitted = await this.db.get(commitKey(subtreeIndex));
      if (isCommitted === "true") {
        return false;
      }

      const rootIsPastRoot = await this.walletContract.isPastRoot(newRoot);
      if (rootIsPastRoot) {
        return false;
      }

      return true;
  }

  private async tryGenAndSubmitProof(): Promise<void> {
    while (this.insertions.length >= BinaryPoseidonTree.BATCH_SIZE) {
      const batch = this.insertions.slice(0, BinaryPoseidonTree.BATCH_SIZE);

      applyBatchUpdateToTree(batch, this.tree);

      // only generate / submit proof if the batch is not already committed
      const subtreeIndex = this.tree.count - batch.length;
      const merkleProof = this.tree.getProof(subtreeIndex);
      const newRoot = this.tree.root();
      const inputs = subtreeUpdateInputsFromBatch(batch, merkleProof);

      if (await this.shouldGenProof(subtreeIndex, newRoot)) {
        const tx = await this.genAndSubmitProof(inputs, newRoot);

        // don't sit there waiting for the tx to mined, but when it's done
        // mark the batch as committed in the DB so we know
        // where we left off if we restart
        // if the TX fails because the given `newRoot` is already committed, then, we consider it committed
        // this can happen if someone else submits an update proof for the batch around the same time
        // if it fails for any other reason, something is wrong.
        (async () => {
          try {
            await tx.wait();
            await this.db.put(commitKey(subtreeIndex), "true");
          } catch (err: any) {
            if (err.toString().includes("newRoot already a past root")) {
              this.db.put(commitKey(this.tree.count), "true");
            } else {
              throw err;
            }
          }
        })();
      } else {
        this.db.put(commitKey(this.tree.count), "true");
      }

      this.insertions.splice(0, BinaryPoseidonTree.BATCH_SIZE);
    }
  }

  public async recoverPersisedState(): Promise<void> {
    await this.getNextBlockToIndex();
    const nextInsertionIndex = await this.getNextInsertionIndex();
    const start = insertionKey(0);
    const end = insertionKey(nextInsertionIndex);

    for (const { key, value } of this.db.getRange({ start, end })) {
      if (value === undefined) {
        throw new Error(`DB entry not found: ${key}`);
      }
      const insertion = JSON.parse(value) as Note | bigint;
      this.insertions.push(insertion);

      if (this.insertions.length >= RECOVERY_CHUNK_SIZE) {
        await this.tryGenAndSubmitProof();
      }
    }

    await this.tryGenAndSubmitProof();
  }

  public async poll(): Promise<void> {
    const currentBlockNumber = await this.walletContract.provider.getBlockNumber();
    const nextBlockToIndex = await this.getNextBlockToIndex();
    if (nextBlockToIndex > currentBlockNumber) {
      return;
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
    
    await this.tryGenAndSubmitProof();
  }

  public async fillBatch(): Promise<void> {
    await this.walletContract.fillBatchWithZeros();
  }

  public async dropDB(): Promise<void> {
    await this.db.drop();
  }
}

export function applyBatchUpdateToTree(batch: (Note | bigint)[], tree: BinaryPoseidonTree): void {
  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];
    if (typeof item === "bigint") {
      tree.insert(item);
    } else {
      tree.insert(NoteTrait.toCommitment(item));
    }
  }
}