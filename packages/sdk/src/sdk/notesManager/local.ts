import { Wallet, Wallet__factory } from "@flax/contracts";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { FlaxDB } from "../db";
import { query } from "../utils";
import {
  RefundEvent as EthRefundEvent,
  SpendEvent as EthSpendEvent,
} from "@flax/contracts/dist/src/Wallet";
import { NotesManager } from ".";
import { IncludedNote } from "../note";

const DEFAULT_START_BLOCK = 0;
const REFUNDS_LAST_INDEXED_BLOCK = "REFUNDS_LAST_INDEXED_BLOCK";
const SPENDS_LAST_INDEXED_BLOCK = "SPENDS_LAST_INDEXED_BLOCK";

export class LocalNotesManager extends NotesManager {
  walletContract: Wallet;
  provider: ethers.providers.Provider;

  constructor(
    walletAddress: Address,
    provider: ethers.providers.Provider,
    db: FlaxDB
  ) {
    super(db);
    this.provider = provider;
    this.walletContract = Wallet__factory.connect(walletAddress, this.provider);
  }

  async fetchAndStoreRefunds(): Promise<void> {
    const maybeLastSeen = this.db.getKv(REFUNDS_LAST_INDEXED_BLOCK);
    const lastSeen = maybeLastSeen
      ? parseInt(maybeLastSeen) + 1
      : DEFAULT_START_BLOCK; // TODO: load default from network-specific config
    const latestBlock = await this.provider.getBlockNumber();

    const filter = this.walletContract.filters.Refund();
    let events: EthRefundEvent[] = await query(
      this.walletContract,
      filter,
      lastSeen,
      latestBlock
    );

    events = events.sort((a, b) => a.blockNumber - b.blockNumber);

    const newNotes = events.map((event) => {
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

    await this.db.storeNotes(newNotes);
    await this.db.putKv(REFUNDS_LAST_INDEXED_BLOCK, latestBlock.toString());
  }
  //newNonce = H(vk, nf)
  async fetchAndApplySpends(): Promise<void> {
    const maybeLastSeen = this.db.getKv(SPENDS_LAST_INDEXED_BLOCK);
    const lastSeen = maybeLastSeen
      ? parseInt(maybeLastSeen) + 1
      : DEFAULT_START_BLOCK; // TODO: load default from network-specific config
    const latestBlock = await this.provider.getBlockNumber();

    const filter = this.walletContract.filters.Spend();
    let events: EthSpendEvent[] = await query(
      this.walletContract,
      filter,
      lastSeen,
      latestBlock
    );

    events = events.sort((a, b) => a.blockNumber - b.blockNumber);

    const newSpends = events.map((event) => {
      const { oldNoteNullifier, valueSpent, merkleIndex } = event.args;
      return {
        oldNoteNullifier: oldNoteNullifier.toBigInt(),
        valueSpent: valueSpent.toBigInt(),
        merkleIndex: merkleIndex.toNumber(),
      };
    });
    console.log(newSpends);

    // Find/remove old note and store new one by changing refundAddr and
    // calculating new nonce
  }
}
