import { BatchBinaryMerkle, BatchBinaryMerkle__factory } from "@flax/contracts";
import { LeavesEnqueuedEvent } from "@flax/contracts/dist/src/BatchBinaryMerkle";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { BinaryPoseidonTree } from "../../primitives/binaryPoseidonTree";
import { LocalMerkleDBExtension } from "../db";
import { query } from "../utils";
import { MerkleProver } from ".";
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";

const DEFAULT_START_BLOCK = 0;
const MERKLE_LAST_INDEXED_BLOCK = "MERKLE_LAST_INDEXED_BLOCK";

export class LocalMerkleProver extends MerkleProver {
  readonly localTree: BinaryPoseidonTree;
  protected treeContract: BatchBinaryMerkle;
  protected provider: ethers.providers.Provider;
  protected db: LocalMerkleDBExtension;

  constructor(
    merkleAddress: Address,
    provider: ethers.providers.Provider,
    db: LocalMerkleDBExtension
  ) {
    super();

    this.localTree = new BinaryPoseidonTree();
    this.provider = provider;
    this.treeContract = BatchBinaryMerkle__factory.connect(
      merkleAddress,
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
      if (!leaf) {
        return self;
      } else {
        self.localTree.insert(leaf);
        index += 1;
      }
    }
  }

  async getProof(index: number): Promise<MerkleProof> {
    return this.localTree.getProof(index);
  }

  async fetchLeavesAndUpdate(): Promise<void> {
    // TODO: load default from network-specific config
    const lastSeen =
      (await this.db.getNumberKv(MERKLE_LAST_INDEXED_BLOCK)) ??
      DEFAULT_START_BLOCK;
    const latestBlock = await this.provider.getBlockNumber();

    const newLeaves = await this.fetchNewLeavesSorted(lastSeen, latestBlock);

    for (const leaf of newLeaves) {
      await this.db.storeLeaf(this.localTree.count, leaf);
      this.localTree.insert(leaf);
    }

    await this.db.putKv(MERKLE_LAST_INDEXED_BLOCK, latestBlock.toString());
  }

  async fetchNewLeavesSorted(from: number, to: number): Promise<bigint[]> {
    const filter = this.treeContract.filters.LeavesEnqueued();
    let events: LeavesEnqueuedEvent[] = await query(
      this.treeContract,
      filter,
      from,
      to
    );

    events = events.sort((a, b) => a.blockNumber - b.blockNumber);

    const allLeaves: bigint[] = [];
    for (const event of events) {
      const eventLeaves = event.args.leaves.map((l) => l.toBigInt());
      allLeaves.push(...eventLeaves);
    }
    return allLeaves;
  }
}
