import { Wallet, Wallet__factory } from "@flax/contracts";
import { RefundEvent } from "@flax/contracts/dist/src/Wallet";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { FlaxDB } from "../db";
import { IncludedNote } from "../note";
import { query } from "../utils";
import { NotesManager } from ".";

const DEFAULT_START_BLOCK = 0;
const REFUNDS_LAST_INDEXED_BLOCK = "REFUNDS_LAST_INDEXED_BLOCK";

export class ChainIndexingNotesManager implements NotesManager {
  db: FlaxDB;
  walletContract: Wallet;
  provider: ethers.providers.Provider;

  constructor(walletAddress: Address, rpcUrl: string, db: FlaxDB) {
    this.db = db;
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.walletContract = Wallet__factory.connect(walletAddress, this.provider);
  }

  async gatherNewRefunds(): Promise<IncludedNote[]> {
    const maybeLastSeen = this.db.getKv(REFUNDS_LAST_INDEXED_BLOCK);
    const lastSeen = maybeLastSeen
      ? parseInt(maybeLastSeen)
      : DEFAULT_START_BLOCK; // TODO: load default from network-specific config
    const latestBlock = await this.provider.getBlockNumber();

    const filter = this.walletContract.filters.Refund();
    let events: RefundEvent[] = await query(
      this.walletContract,
      filter,
      lastSeen,
      latestBlock
    );

    events = events.sort((a, b) => a.blockNumber - b.blockNumber);

    return events.map((event) => {
      const { refundAddr, nonce, asset, id, value, merkleIndex } = event.args;
      const { h1X, h1Y, h2X, h2Y } = refundAddr;
      return new IncludedNote({
        owner: {
          h1X: h1X.toBigInt(),
          h1Y: h1Y.toBigInt(),
          h2X: h2X.toBigInt(),
          h2Y: h2Y.toBigInt(),
        },
        nonce: nonce.toBigInt(),
        asset,
        id: id.toBigInt(),
        value: value.toBigInt(),
        merkleIndex: merkleIndex.toNumber(),
      });
    });
  }
}
