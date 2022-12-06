import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { BinaryPoseidonTree } from "../../primitives/binaryPoseidonTree";
import { LocalMerkleDBExtension } from "../db";
import { MerkleProver } from ".";
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { NoteTrait } from "../note";
import { fetchInsertions } from "../../indexing";

const DEFAULT_START_BLOCK = 0;
const MERKLE_NEXT_BLOCK_TO_INDEX = "MERKLE_NEXT_BLOCK_TO_INDEX";

export class LocalMerkleProver extends MerkleProver {
  readonly localTree: BinaryPoseidonTree;
  protected contract: Wallet;
  protected provider: ethers.providers.Provider;
  protected db: LocalMerkleDBExtension;

  constructor(
    walletContractAddress: Address,
    provider: ethers.providers.Provider,
    db: LocalMerkleDBExtension
  ) {
    super();

    this.localTree = new BinaryPoseidonTree();
    this.provider = provider;
    this.contract = Wallet__factory.connect(
      walletContractAddress,
      this.provider
    );
    this.db = db;
  }

  static async fromDb(
    merkleAddress: Address,
    provider: ethers.providers.Provider,
    db: LocalMerkleDBExtension
  ): Promise<LocalMerkleProver> {
    const self = new LocalMerkleProver(merkleAddress, provider, db);

    let index = 0;
    // eslint-disable-next-line
    while (true) {
      const leaf = await db.getLeaf(index);
      if (leaf == undefined) {
        return self;
      } else {
        self.localTree.insert(leaf);
        index += 1;
      }
    }
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
      (await this.db.getNumberKv(MERKLE_NEXT_BLOCK_TO_INDEX)) ??
      DEFAULT_START_BLOCK;
    const latestBlock = await this.provider.getBlockNumber();

    const newLeaves = await this.fetchNewLeaves(nextBlockToIndex, latestBlock);

    for (const leaf of newLeaves) {
      await this.db.storeLeaf(this.localTree.count, leaf);
      this.localTree.insert(leaf);
    }

    await this.db.putKv(
      MERKLE_NEXT_BLOCK_TO_INDEX,
      (latestBlock + 1).toString()
    );
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
