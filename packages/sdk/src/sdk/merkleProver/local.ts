import { BatchBinaryMerkle, BatchBinaryMerkle__factory } from "@flax/contracts";
import { LeavesEnqueuedEvent } from "@flax/contracts/dist/src/BatchBinaryMerkle";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { BinaryPoseidonTree } from "../../primitives/binaryPoseidonTree";
import { FlaxLMDB } from "../db";
import { query } from "../utils";
import { MerkleProver } from ".";

const DEFAULT_START_BLOCK = 0;
const MERKLE_LAST_INDEXED_BLOCK = "MERKLE_LAST_INDEXED_BLOCK";

export class LocalMerkleProver
  extends BinaryPoseidonTree
  implements MerkleProver
{
  treeContract: BatchBinaryMerkle;
  provider: ethers.providers.Provider;
  db: FlaxLMDB;

  constructor(
    merkleAddress: Address,
    provider: ethers.providers.Provider,
    db: FlaxLMDB
  ) {
    super();

    this.provider = provider;
    this.treeContract = BatchBinaryMerkle__factory.connect(
      merkleAddress,
      this.provider
    );
    this.db = db;
  }

  async fetchLeavesAndUpdate(): Promise<void> {
    const maybeLastSeen = this.db.getKv(MERKLE_LAST_INDEXED_BLOCK);
    const lastSeen = maybeLastSeen
      ? parseInt(maybeLastSeen)
      : DEFAULT_START_BLOCK; // TODO: load default from network-specific config
    const latestBlock = await this.provider.getBlockNumber();

    const newLeaves = await this.fetchNewLeavesSorted(lastSeen, latestBlock);

    for (const leaf of newLeaves) {
      this.db.storeLeaf(this.count, leaf);
      this.insert(leaf);
    }

    this.db.putKv(MERKLE_LAST_INDEXED_BLOCK, latestBlock.toString());
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

    let allLeaves: bigint[] = [];
    for (const event of events) {
      const eventLeaves = event.args.leaves.map((l) => l.toBigInt());
      allLeaves.push(...eventLeaves);
    }
    return allLeaves;
  }
}
