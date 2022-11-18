import { OffchainMerkleTree, OffchainMerkleTree__factory } from "@flax/contracts";
import { LeavesEnqueuedEvent, LeavesCommittedEvent } from "@flax/contracts/dist/src/OffchainMerkleTree";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { BinaryPoseidonTree } from "../../primitives/binaryPoseidonTree";
import { FlaxLMDB } from "../db";
import { query } from "../utils";
import { MerkleProver } from ".";

const DEFAULT_START_BLOCK = 0;
const MERKLE_LAST_INDEXED_BLOCK = "MERKLE_LAST_INDEXED_BLOCK";
const MERKLE_LAST_IDX = "MERKLE_LAST_IDX";

let batchSize: number | undefined = undefined;


export class LocalMerkleProver
  extends BinaryPoseidonTree
  implements MerkleProver
{
  treeContract: OffchainMerkleTree;
  provider: ethers.providers.Provider;
  db: FlaxLMDB;

  constructor(
    merkleAddress: Address,
    provider: ethers.providers.Provider,
    db: FlaxLMDB
  ) {
    super();

    this.provider = provider;
    this.treeContract = OffchainMerkleTree__factory.connect(
      merkleAddress,
      this.provider
    );
    this.db = db;
  }

  async fetchLeaves(): Promise<void> {
    // TODO: load default from network-specific config
    const lastSeen =
      this.db.getNumberKv(MERKLE_LAST_INDEXED_BLOCK) ?? DEFAULT_START_BLOCK;
    const latestBlock = await this.provider.getBlockNumber();
    let leafIdx = this.db.getNumberKv(MERKLE_LAST_IDX) ?? 0;

    const newLeaves = await this.fetchNewLeavesSorted(lastSeen, latestBlock);

    for (const leaf of newLeaves) {
      this.db.storeLeaf(leafIdx, leaf);
      leafIdx += 1;
    }

    await this.db.putKv(MERKLE_LAST_INDEXED_BLOCK, latestBlock.toString());
  }

  async fetchCommitsAndUpdate(from: number, to: number): Promise<void> {
    const filter = this.treeContract.filters.LeavesCommitted();
    let events: LeavesCommittedEvent[] = await query(
      this.treeContract,
      filter,
      from,
      to
    );

    events = events.sort((a, b) => a.blockNumber - b.blockNumber);

    if (!batchSize) {
      batchSize = Number(await this.treeContract.BATCH_SIZE());
    }


    for (const event of events) {
      const [subtreeIndex, newRoot] = event.args;
      const subtreeIdx = Number(subtreeIndex);
      const proms = [...Array(batchSize).keys()].map(async i => {
        await this.db.storeLeafCommit(subtreeIdx + i);
        
        const leaf = await this.db.getLeaf(subtreeIdx + i);
        this.tree.insert(leaf);
      });

      Promise.all(proms);

      // sanity check
      const root = this.tree.root();
      if (root !== newRoot.toBigInt()) {
        throw new Error("failed to sync with offchain merkle tree - got different roots!");
      }
    }
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
