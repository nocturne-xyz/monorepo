import { OffchainMerkleTree, OffchainMerkleTree__factory } from "@flax/contracts";
import { InsertNoteCommitmentsEvent, InsertNotesEvent } from "@flax/contracts/dist/src/OffchainMerkleTree";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { BinaryPoseidonTree } from "../../primitives/binaryPoseidonTree";
import { FlaxLMDB } from "../db";
import { query } from "../utils";
import { MerkleProver } from ".";
import { Note } from "../note";

const DEFAULT_START_BLOCK = 0;
const MERKLE_NEXT_BLOCK_TO_INDEX = "MERKLE_NEXT_BLOCK_TO_INDEX";

export class LocalMerkleProver
  extends BinaryPoseidonTree
  implements MerkleProver
{
  contract: OffchainMerkleTree;
  provider: ethers.providers.Provider;
  db: FlaxLMDB;

  constructor(
    merkleAddress: Address,
    provider: ethers.providers.Provider,
    db: FlaxLMDB
  ) {
    super();

    this.provider = provider;
    this.contract = OffchainMerkleTree__factory.connect(
      merkleAddress,
      this.provider
    );
    this.db = db;
  }

  async fetchLeavesAndUpdate(): Promise<void> {
    // TODO: load default from network-specific config
    const nextBlockToIndex =
      this.db.getNumberKv(MERKLE_NEXT_BLOCK_TO_INDEX) ?? DEFAULT_START_BLOCK;
    const latestBlock = await this.provider.getBlockNumber();

    const newLeaves = await this.fetchNewLeaves(nextBlockToIndex, latestBlock);

    for (const leaf of newLeaves) {
      this.db.storeLeaf(this.count, leaf);
      this.insert(leaf);
    }

    await this.db.putKv(MERKLE_NEXT_BLOCK_TO_INDEX, (latestBlock + 1).toString());
  }

  async fetchNewLeaves(from: number, to: number): Promise<bigint[]> {
    // fetch both kind of insertion events (note commitments and full notes)
    const ncEventsProm: Promise<InsertNoteCommitmentsEvent[]> = query(
      this.contract,
      this.contract.filters.InsertNoteCommitments(),
      from,
      to
    );
    const noteEventsProm: Promise<InsertNotesEvent[]> = query(
      this.contract,
      this.contract.filters.InsertNotes(),
      from,
      to
    );

    const [noteCommitmentEvents, noteEvents] = await Promise.all([ncEventsProm, noteEventsProm]);

    // extract leaves from each (note commitments are the leaves, full notes have to be hashed)
    // combine them into a single list
    // and sort them in the order in which they appeared on-chain

    interface OrderedLeaf {
      leaf: bigint,
      blockNumber: number,
      txIdx: number,
      logIdx: number
    }

    let leaves: OrderedLeaf[] = [];
    for (const event of noteCommitmentEvents) {
        const eventLeaves = event.args.commitments.map((l) => l.toBigInt());
        const orderedLeaves = eventLeaves.map(leaf => ({
          leaf,
          blockNumber: event.blockNumber,
          txIdx: event.transactionIndex,
          logIdx: event.logIndex,
        }));
        leaves.push(...orderedLeaves);
    }

    for (const event of noteEvents) {
        for (const noteValues of event.args.notes) {
          const owner = {
            h1X: noteValues.ownerH1.toBigInt(),
            h2X: noteValues.ownerH2.toBigInt(),
            h1Y: 0n,
            h2Y: 0n,
          };

          const noteStruct = {
            owner,
            nonce: noteValues.nonce.toBigInt(),
            asset: noteValues.asset.toHexString(),
            id: noteValues.id.toBigInt(),
            value: noteValues.value.toBigInt(),
          };

          const note = new Note(noteStruct);
          const leaf = note.toCommitment();
          leaves.push({
            leaf,
            blockNumber: event.blockNumber,
            txIdx: event.transactionIndex,
            logIdx: event.logIndex,
          });
        }
    }

    leaves = leaves.sort((a, b) => a.blockNumber - b.blockNumber || a.txIdx - b.txIdx || a.logIdx - b.logIdx);

    // return only the leaves
    return leaves.map(({ leaf }) => leaf);
  }
}