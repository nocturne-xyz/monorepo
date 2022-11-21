import { Wallet, Wallet__factory } from "@flax/contracts";
import { InsertNoteCommitmentsEvent, InsertNotesEvent } from "@flax/contracts/dist/src/CommitmentTreeManager";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { BinaryPoseidonTree } from "../../primitives/binaryPoseidonTree";
import { FlaxLMDB } from "../db";
import { query } from "../utils";
import { MerkleProver } from ".";
import { Note } from "../note";

const DEFAULT_START_BLOCK = 0;
const MERKLE_NEXT_BLOCK_TO_INDEX = "MERKLE_NEXT_BLOCK_TO_INDEX";


enum UpdateKind {
  NOTE,
  NOTE_COMMITMENT
};


export class LocalMerkleProver
  extends BinaryPoseidonTree
  implements MerkleProver
{
  contract: Wallet;
  provider: ethers.providers.Provider;
  db: FlaxLMDB;
  lastCommittedIndex: number;

  constructor(
    walletAddress: Address,
    provider: ethers.providers.Provider,
    db: FlaxLMDB
  ) {
    super();

    this.provider = provider;
    this.contract = Wallet__factory.connect(
      walletAddress,
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
      this.fetchNewLeaves(nextBlockToIndex, latestBlock),
      this.fetchLastCommittedIndex(),
    ]);

    for (const leaf of newLeaves) {
      this.db.storeLeaf(this.count, leaf);
      this.insert(leaf);
    }
    this.lastCommittedIndex = lastCommittedIndex;

    await this.db.putKv(MERKLE_NEXT_BLOCK_TO_INDEX, (latestBlock + 1).toString());
  }

  async fetchNewLeaves(from: number, to: number): Promise<bigint[]> {

    const proms = [];
    proms.push(
      query(
        this.contract,
        this.contract.filters.InsertNoteCommitments(),
        from,
        to
      )
    );
    proms.push(
      query(
        this.contract,
        this.contract.filters.InsertNotes(),
        from,
        to
      )
    );
    const [noteCommitmentEvents, noteEvents] = await Promise.all(proms);
    let taggedEvents = noteCommitmentEvents.map(event => [UpdateKind.NOTE_COMMITMENT, event]);
    taggedEvents = taggedEvents.concat(
      noteEvents.map(event => [UpdateKind.NOTE, event])
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const events = (taggedEvents as [UpdateKind, InsertNoteCommitmentsEvent | InsertNotesEvent][]).sort(([_akind, a], [_bkind, b]) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex || a.logIndex - b.logIndex);

    const allLeaves = [];
    for (const [kind, event] of events) {
      if (kind === UpdateKind.NOTE_COMMITMENT) {
        const e = event as InsertNoteCommitmentsEvent;
        const eventLeaves = e.args.commitments.map((l) => l.toBigInt());
        allLeaves.push(...eventLeaves);
      } else if (kind === UpdateKind.NOTE) {
        const e = event as InsertNotesEvent;
        for (const noteValues of e.args.notes) {
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
          const commitment = note.toCommitment();
          allLeaves.push(commitment);
        }
      } else {
        throw new Error("unexpected event kind");
      }
    }
    return allLeaves;
  }

  async fetchLastCommittedIndex(): Promise<number> {
    const res = await this.contract.count();
    return res.toNumber();
  }
}