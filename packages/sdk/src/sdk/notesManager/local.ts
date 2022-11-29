import { Wallet, Wallet__factory } from "@flax/contracts";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { FlaxDB } from "../db";
import { query } from "../utils";
import {
  RefundEvent as EthRefundEvent,
  SpendEvent as EthSpendEvent,
} from "@flax/contracts/dist/src/Wallet";
import { NotesManager, SpendEvent } from ".";
import { FlaxSigner } from "../signer";
import { IncludedNoteStruct } from "../note";

const DEFAULT_START_BLOCK = 0;
const REFUNDS_LAST_INDEXED_BLOCK = "REFUNDS_LAST_INDEXED_BLOCK";
const REFUNDS_TENTATIVE_LAST_INDEXED_BLOCK =
  "REFUNDS_TENTATIVE_LAST_INDEXED_BLOCK";
const SPENDS_LAST_INDEXED_BLOCK = "SPENDS_LAST_INDEXED_BLOCK";
const SPENDS_TENTATIVE_LAST_INDEXED_BLOCK =
  "SPENDS_TENTATIVE_LAST_INDEXED_BLOCK";

export class LocalNotesManager extends NotesManager {
  walletContract: Wallet;
  provider: ethers.providers.Provider;

  constructor(
    db: FlaxDB,
    signer: FlaxSigner,
    walletAddress: Address,
    provider: ethers.providers.Provider
  ) {
    super(db, signer);
    this.provider = provider;
    this.walletContract = Wallet__factory.connect(walletAddress, this.provider);
  }

  async fetchNotesFromRefunds(): Promise<IncludedNoteStruct[]> {
    // TODO: load default from network-specific config
    const lastSeen =
      (await this.db.getNumberKv(REFUNDS_LAST_INDEXED_BLOCK)) ??
      DEFAULT_START_BLOCK;
    const latestBlock = await this.provider.getBlockNumber();

    const filter = this.walletContract.filters.Refund();
    let events: EthRefundEvent[] = await query(
      this.walletContract,
      filter,
      lastSeen,
      latestBlock
    );

    events = events.sort((a, b) => a.blockNumber - b.blockNumber);

    const newRefunds = events.map((event) => {
      const { refundAddr, nonce, asset, id, value, merkleIndex } = event.args;
      const { h1X, h1Y, h2X, h2Y } = refundAddr;
      return {
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
      };
    });

    await this.db.putKv(
      REFUNDS_TENTATIVE_LAST_INDEXED_BLOCK,
      latestBlock.toString()
    );
    return newRefunds;
  }

  async postStoreNotesFromRefunds(): Promise<void> {
    const tentativeLastSeen = await this.db.getKv(
      REFUNDS_TENTATIVE_LAST_INDEXED_BLOCK
    );

    if (!tentativeLastSeen) {
      throw new Error(
        "Should never call `postStoreNotesFromRefunds` without having stored a tentative last seen block"
      );
    }

    await this.db.putKv(REFUNDS_LAST_INDEXED_BLOCK, tentativeLastSeen);
  }

  async fetchSpends(): Promise<SpendEvent[]> {
    // TODO: load default from network-specific config
    const lastSeen =
      (await this.db.getNumberKv(SPENDS_LAST_INDEXED_BLOCK)) ??
      DEFAULT_START_BLOCK;
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

    await this.db.putKv(
      SPENDS_TENTATIVE_LAST_INDEXED_BLOCK,
      latestBlock.toString()
    );
    return newSpends;
  }

  async postApplySpends(): Promise<void> {
    const tentativeLastSeen = await this.db.getKv(
      SPENDS_TENTATIVE_LAST_INDEXED_BLOCK
    );

    if (!tentativeLastSeen) {
      throw new Error(
        "Should never call `postApplySpends` without having stored a tentative last seen block"
      );
    }

    await this.db.putKv(SPENDS_LAST_INDEXED_BLOCK, tentativeLastSeen);
  }
}
