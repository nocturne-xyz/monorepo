import { OffchainMerkleTree, OffchainMerkleTree__factory } from "@flax/contracts";
import { LeavesEnqueuedEvent } from "@flax/contracts/dist/src/OffchainMerkleTree";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { BinaryPoseidonTree } from "../../primitives/binaryPoseidonTree";
import { FlaxLMDB } from "../db";
import { query } from "../utils";
import { MerkleProver } from ".";

const DEFAULT_START_BLOCK = 0;
const MERKLE_NEXT_BLOCK_TO_INDEX = "MERKLE_NEXT_BLOCK_TO_INDEX";


export class LocalMerkleProver
  extends BinaryPoseidonTree
  implements MerkleProver
{
  treeContract: OffchainMerkleTree;
  provider: ethers.providers.Provider;
  db: FlaxLMDB;
  lastCommittedIndex: number;

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
    this.lastCommittedIndex = 0;
  }

  async fetchLeavesAndUpdate(): Promise<void> {
    // TODO: load default from network-specific config
    const nextBlockToIndex =
      this.db.getNumberKv(MERKLE_NEXT_BLOCK_TO_INDEX) ?? DEFAULT_START_BLOCK;
    const latestBlock = await this.provider.getBlockNumber();

    console.log("from", nextBlockToIndex, "to", latestBlock);

    const [newLeaves, lastCommittedIndex] = await Promise.all([
      this.fetchNewLeavesSorted(nextBlockToIndex, latestBlock),
      this.fetchLastCommittedIndex(),
    ]);

    for (const leaf of newLeaves) {
      this.db.storeLeaf(this.count, leaf);
      this.insert(leaf);
    }
    this.lastCommittedIndex = lastCommittedIndex;

    await this.db.putKv(MERKLE_NEXT_BLOCK_TO_INDEX, (latestBlock + 1).toString());
  }

  async fetchNewLeavesSorted(from: number, to: number): Promise<bigint[]> {
    const filter = this.treeContract.filters.LeavesEnqueued();
    let events: LeavesEnqueuedEvent[] = await query(
      this.treeContract,
      filter,
      from,
      to
    );

    console.log(events);

    events = events.sort((a, b) => a.blockNumber - b.blockNumber);

    const allLeaves: bigint[] = [];
    for (const event of events) {
      const eventLeaves = event.args.leaves.map((l) => l.toBigInt());
      allLeaves.push(...eventLeaves);
    }
    return allLeaves;
  }

  async fetchLastCommittedIndex(): Promise<number> {
    const res = await this.treeContract.committedCount();
    return res.toNumber();
  }
}