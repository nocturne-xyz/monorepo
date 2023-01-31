import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { BinaryPoseidonTree } from "../../primitives/binaryPoseidonTree";
import { MerkleDB } from "../db";
import { MerkleProver } from "./abstract";
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { NoteTrait } from "../note";
import { fetchInsertions, fetchSubtreeUpdateCommits } from "../../indexing";

const DEFAULT_START_BLOCK = 0;
const MERKLE_NEXT_BLOCK_TO_INDEX = "MERKLE_NEXT_BLOCK_TO_INDEX";
const MERKLE_LAST_COMMITTED_INDEX = "MERKLE_LAST_COMMITTED_INDEX";

export interface LocalMerkleProverOpts {
  startBlock?: number;
}

export class LocalMerkleProver extends MerkleProver {
  readonly localTree: BinaryPoseidonTree;
  protected contract: Wallet;
  protected provider: ethers.providers.Provider;
  protected db: MerkleDB;
  protected startBlock: number;

  constructor(
    walletContractAddress: Address,
    provider: ethers.providers.Provider,
    db: MerkleDB,
    opts?: LocalMerkleProverOpts
  ) {
    super();

    this.localTree = new BinaryPoseidonTree();
    this.provider = provider;
    this.contract = Wallet__factory.connect(
      walletContractAddress,
      this.provider
    );
    this.db = db;
    this.startBlock = opts?.startBlock ?? DEFAULT_START_BLOCK;
  }

  static async fromDb(
    merkleAddress: Address,
    provider: ethers.providers.Provider,
    db: MerkleDB,
    opts?: LocalMerkleProverOpts
  ): Promise<LocalMerkleProver> {
    const self = new LocalMerkleProver(merkleAddress, provider, db, opts);

    for await (const leaf of db.iterLeaves()) {
      self.localTree.insert(leaf);
    }

    return self;
  }

  root(): bigint {
    return this.localTree.root();
  }

  count(): number {
    return this.localTree.count;
  }

  async getProof(index: number): Promise<MerkleProof> {
    return this.localTree.getProof(index);
  }

  async fetchLeavesAndUpdate(): Promise<void> {
    // get new leaves
    // TODO: load default from network-specific config
    const nextBlockToIndex =
      (await this.db.kv.getNumber(MERKLE_NEXT_BLOCK_TO_INDEX)) ??
      this.startBlock;
    const latestBlock = await this.provider.getBlockNumber();
    const newLeaves = await this.fetchNewLeaves(nextBlockToIndex, latestBlock);

    // store them in db
    for (const leaf of newLeaves) {
      await this.db.storeLeaf(this.localTree.count, leaf);
    }

    // update last committed index
    const lastCommittedIndex = await this.fetchLastCommittedIndex(nextBlockToIndex, latestBlock);
    const newCommittedLeaves = newLeaves.slice(0, Math.max(lastCommittedIndex - (this.localTree.count - 1), 0));
    for (const leaf of newCommittedLeaves) {
      this.localTree.insert(leaf);
    }

    // TODO: get KV store to support transactions for non-string value types
    await this.db.kv.putNumber(MERKLE_LAST_COMMITTED_INDEX, lastCommittedIndex);
    await this.db.kv.putNumber(MERKLE_NEXT_BLOCK_TO_INDEX, latestBlock + 1);
  }

  async fetchLastCommittedIndex(from: number, to: number): Promise<number> {
    const commitEvents = await fetchSubtreeUpdateCommits(this.contract, from, to);

    if (commitEvents.length === 0) {
      return await this.db.kv.getNumber(MERKLE_LAST_COMMITTED_INDEX) ?? -1;
    }

    // the last committed subtree index is the last event's subtree index
    // the index of the first leaf in the last committed subtree is the last committed subtree index times the batch size
    // to get the last leaf of the subtree, we add the batch size and subtract 1
    const lastCommittedSubtreeIndex = commitEvents[commitEvents.length - 1].subtreeIndex;
    return (lastCommittedSubtreeIndex + 1) * BinaryPoseidonTree.BATCH_SIZE - 1;
  }

  async fetchNewLeaves(from: number, to: number): Promise<bigint[]> {
    const insertions = await fetchInsertions(this.contract, from, to);
    return insertions.map((insertion) => {
      if (typeof insertion === "bigint") {
        // it's a note commitment
        return insertion;
      } else {
        // it's a note
        return NoteTrait.toCommitment(insertion);
      }
    });
  }
}
