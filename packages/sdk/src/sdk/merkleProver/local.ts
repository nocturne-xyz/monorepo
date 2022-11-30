import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import {
  InsertNoteCommitmentsEvent,
  InsertNotesEvent,
} from "@nocturne-xyz/contracts/dist/src/Wallet";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { BinaryPoseidonTree } from "../../primitives/binaryPoseidonTree";
import { LocalMerkleDBExtension } from "../db";
import { query } from "../utils";
import { MerkleProver } from ".";
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { Note } from "../note";

const DEFAULT_START_BLOCK = 0;
const MERKLE_NEXT_BLOCK_TO_INDEX = "MERKLE_NEXT_BLOCK_TO_INDEX";

interface OrderedLeaf {
  leaf: bigint;
  blockNumber: number;
  txIdx: number;
  logIdx: number;
}

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

    const [noteCommitmentEvents, noteEvents] = await Promise.all([
      ncEventsProm,
      noteEventsProm,
    ]);

    // extract leaves from each (note commitments are the leaves, full notes have to be hashed)
    // combine them into a single list
    // and sort them in the order in which they appeared on-chain

    let leaves: OrderedLeaf[] = [];
    for (const event of noteCommitmentEvents) {
      const eventLeaves = event.args.commitments.map((l) => l.toBigInt());
      const orderedLeaves = eventLeaves.map((leaf) => ({
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

    leaves = leaves.sort(
      (a, b) =>
        a.blockNumber - b.blockNumber ||
        a.txIdx - b.txIdx ||
        a.logIdx - b.logIdx
    );

    // return only the leaves
    return leaves.map(({ leaf }) => leaf);
  }
}
