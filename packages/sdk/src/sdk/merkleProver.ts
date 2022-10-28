import { Wallet, Wallet__factory } from "@flax/contracts";
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { ethers } from "ethers";
import { Address } from "../commonTypes";
import { BinaryPoseidonTree } from "../primitives/binaryPoseidonTree";
import { FlaxDB } from "./flaxDb";

export interface MerkleProver {
  getProof(index: number): MerkleProof;
}

// const LAST_INDEXED_BLOCK_PREFIX = "LAST_INDEXED_BLOCK_";

export class LocalSyncingMerkleProver
  extends BinaryPoseidonTree
  implements MerkleProver
{
  wallet: Wallet;
  db: FlaxDB;

  constructor(walletAddress: Address, rpcUrl: string, db: FlaxDB) {
    super();

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.wallet = Wallet__factory.connect(walletAddress, provider);
    this.db = db;
  }

  async gatherNewLeaves(): Promise<bigint[]> {
    // TODO: load fromBlock and toBlock from FlaxDB
    let fromBlock = 0;
    let toBlock = 0;

    const filter = this.wallet.filters.Refund();
    const events = await this.wallet.queryFilter(filter, fromBlock, toBlock);
    return [];
  }
}
