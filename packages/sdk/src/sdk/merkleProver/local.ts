import { Wallet, Wallet__factory} from "@flax/contracts";
import { InsertNoteCommitmentsEvent, InsertNotesEvent } from "@flax/contracts/dist/src/Wallet";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { BinaryPoseidonTree } from "../../primitives/binaryPoseidonTree";
import { FlaxLMDB } from "../db";
import { MerkleProver } from ".";
import { fetchInsertions } from "../indexing";

const DEFAULT_START_BLOCK = 0;
const MERKLE_NEXT_BLOCK_TO_INDEX = "MERKLE_NEXT_BLOCK_TO_INDEX";

export class LocalMerkleProver
  extends BinaryPoseidonTree
  implements MerkleProver
{
  contract: Wallet;
  provider: ethers.providers.Provider;
  db: FlaxLMDB;

  constructor(
    walletContractAddress: Address,
    provider: ethers.providers.Provider,
    db: FlaxLMDB
  ) {
    super();

    this.provider = provider;
    this.contract = Wallet__factory.connect(
      walletContractAddress,
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
    const insertions = await fetchInsertions(this.contract, from, to);
    return insertions.map(insertion => {
      if (typeof insertion === 'bigint') {
        // it's a note commitment
        return insertion;
      } else {
        // it's a note
        return insertion.toCommitment();
      }
    });
  }
}