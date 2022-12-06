
import { BinaryPoseidonTree, packToSolidityProof, SubtreeUpdateInputs, SubtreeUpdateProver, toJSON } from "@nocturne-xyz/sdk";
import { RootDatabase, Database } from 'lmdb';
import { Wallet } from "@nocturne-xyz/contracts";
import { subtreeUpdateInputsFromBatch } from "@nocturne-xyz/local-prover";
import { NoteTrait, Note } from "@nocturne-xyz/sdk";
import { fetchInsertions } from "@nocturne-xyz/sdk";


const NEXT_BLOCK_TO_INDEX_KEY = "NEXT_BLOCK_TO_INDEX";
const NEXT_INSERTION_INDEX_KEY = "NEXT_INSERTION_INDEX";
const INSERTION_PREFIX = "TREE_INSERTION";

function insertionKey(idx: number) {
  return `${INSERTION_PREFIX}-${idx}`;
}

export interface UpdaterParams {
  walletContract: Wallet;
  rootDB: RootDatabase,
}

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

  private async genAndSubmitProof(inputs: SubtreeUpdateInputs, newRoot: bigint): Promise<void> {
    const { proof } = await this.prover.proveSubtreeUpdate(inputs);
    const solidityProof = packToSolidityProof(proof);
    await this.walletContract.applySubtreeUpdate(newRoot, solidityProof);
  }

  private async tryGenAndSubmitProof(): Promise<void> {
    while (this.insertions.length >= BinaryPoseidonTree.BATCH_SIZE) {
      const batch = this.insertions.slice(0, BinaryPoseidonTree.BATCH_SIZE);
      applyBatchUpdateToTree(batch, this.tree);

      const merkleProof = this.tree.getProof(this.tree.count - batch.length);
      const inputs = subtreeUpdateInputsFromBatch(batch, merkleProof);
      const newRoot = this.tree.root() as bigint;

      await this.genAndSubmitProof(inputs, newRoot);

      this.insertions.splice(0, BinaryPoseidonTree.BATCH_SIZE);
    }
  }

  public async poll(): Promise<void> {
    const currentBlockNumber = await this.walletContract.provider.getBlockNumber();
    const nextBlockToIndex = await this.getNextBlockToIndex();
    if (nextBlockToIndex > currentBlockNumber) {
      return;
    }

    const newInsertions = await fetchInsertions(this.walletContract, nextBlockToIndex, currentBlockNumber);
    this.insertions.push(...newInsertions);
    
    const index = await this.getNextInsertionIndex();
    await this.db.transaction(
      () => {
        let keyIndex = index;
        for (const insertion of newInsertions) {
          this.db.put(insertionKey(keyIndex), toJSON(insertion));
          keyIndex += 1;
        }
      }
    );

    await this.db.put(NEXT_INSERTION_INDEX_KEY, (index + newInsertions.length).toString());
    await this.db.put(NEXT_BLOCK_TO_INDEX_KEY, (currentBlockNumber + 1).toString());
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