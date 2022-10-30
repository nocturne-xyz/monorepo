import { BatchBinaryMerkle, BatchBinaryMerkle__factory } from "@flax/contracts";
import { LeavesCommittedEvent } from "@flax/contracts/dist/src/BatchBinaryMerkle";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { BinaryPoseidonTree } from "../../primitives/binaryPoseidonTree";
import { FlaxDB } from "../flaxDb";
import { query } from "../utils";
import { MerkleProver } from ".";

const DEFAULT_START_BLOCK = 0;
const MERKLE_LAST_INDEXED_BLOCK = "MERKLE_LAST_INDEXED_BLOCK";

export class ChainIndexingMerkleProver
  extends BinaryPoseidonTree
  implements MerkleProver
{
  treeContract: BatchBinaryMerkle;
  provider: ethers.providers.Provider;
  db: FlaxDB;

  constructor(merkleAddress: Address, rpcUrl: string, db: FlaxDB) {
    super();

    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.treeContract = BatchBinaryMerkle__factory.connect(
      merkleAddress,
      this.provider
    );
    this.db = db;
  }

  async gatherNewLeaves(): Promise<bigint[]> {
    let maybeLastSeen = this.db.getKv(MERKLE_LAST_INDEXED_BLOCK);
    const lastSeen = maybeLastSeen
      ? parseInt(maybeLastSeen)
      : DEFAULT_START_BLOCK; // TODO: load default from network-specific config
    let latestBlock = await this.provider.getBlockNumber();

    const filter = this.treeContract.filters.LeavesCommitted();
    let events: LeavesCommittedEvent[] = await query(
      this.treeContract,
      filter,
      lastSeen,
      latestBlock
    );

    events = events.sort((a, b) => a.blockNumber - b.blockNumber);

    let leaves: bigint[] = [];
    for (const event of events) {
      leaves.concat(event.args.leaves.map((l) => l.toBigInt()));
    }
    return leaves;
  }
}
