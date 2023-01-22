import { Handler, Handler__factory } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { BinaryPoseidonTree } from "../../primitives/binaryPoseidonTree";
import { MerkleDB } from "../db";
import { MerkleProver } from "./abstract";
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { NoteTrait } from "../note";
import { fetchInsertions } from "../../indexing";

const DEFAULT_START_BLOCK = 0;
const MERKLE_NEXT_BLOCK_TO_INDEX = "MERKLE_NEXT_BLOCK_TO_INDEX";

export class LocalMerkleProver extends MerkleProver {
  readonly localTree: BinaryPoseidonTree;
  protected contract: Handler;
  protected provider: ethers.providers.Provider;
  protected db: MerkleDB;

  constructor(
    handlerContractAddress: Address,
    provider: ethers.providers.Provider,
    db: MerkleDB
  ) {
    super();

    this.localTree = new BinaryPoseidonTree();
    this.provider = provider;
    this.contract = Handler__factory.connect(
      handlerContractAddress,
      this.provider
    );
    this.db = db;
  }

  static async fromDb(
    merkleAddress: Address,
    provider: ethers.providers.Provider,
    db: MerkleDB
  ): Promise<LocalMerkleProver> {
    const self = new LocalMerkleProver(merkleAddress, provider, db);

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
    // TODO: load default from network-specific config
    const nextBlockToIndex =
      (await this.db.kv.getNumber(MERKLE_NEXT_BLOCK_TO_INDEX)) ??
      DEFAULT_START_BLOCK;
    const latestBlock = await this.provider.getBlockNumber();

    const newLeaves = await this.fetchNewLeaves(nextBlockToIndex, latestBlock);

    for (const leaf of newLeaves) {
      await this.db.storeLeaf(this.localTree.count, leaf);
      this.localTree.insert(leaf);
    }

    await this.db.kv.putNumber(MERKLE_NEXT_BLOCK_TO_INDEX, latestBlock + 1);
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
