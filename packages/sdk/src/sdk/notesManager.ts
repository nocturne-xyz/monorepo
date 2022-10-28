import { Wallet, Wallet__factory } from "@flax/contracts";
import { ethers } from "ethers";
import { Address } from "../commonTypes";
import { FlattenedFlaxAddress } from "../crypto/address";
import { FlaxDB } from "./flaxDb";
import { IncludedNote } from "./note";

export abstract class NotesManager {
  db: FlaxDB;

  constructor(db: FlaxDB) {
    this.db = db;
  }

  abstract gatherNewRefunds(): Promise<IncludedNote[]>;
  // TODO: abstract gatherNewSpends():
  // TODO: method to call two gather functions and update DB accordingly
}

export class ChainIndexingNotesManager extends NotesManager {
  wallet: Wallet;

  constructor(walletAddress: Address, rpcUrl: string, db: FlaxDB) {
    super(db);

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.wallet = Wallet__factory.connect(walletAddress, provider);
  }

  async gatherNewRefunds(): Promise<IncludedNote[]> {
    // TODO: load fromBlock and toBlock from FlaxDB
    let fromBlock = 0;
    let toBlock = 0;

    const filter = this.wallet.filters.Refund();
    const events = await this.wallet.queryFilter(filter, fromBlock, toBlock);
    return events.map((event) => {
      const { refundAddr, nonce, asset, id, value, merkleIndex } = event.args;
      const { h1X, h1Y, h2X, h2Y } = refundAddr;
      return new IncludedNote(
        {
          owner: new FlattenedFlaxAddress({
            h1X: h1X.toBigInt(),
            h1Y: h1Y.toBigInt(),
            h2X: h2X.toBigInt(),
            h2Y: h2Y.toBigInt(),
          }),
          nonce: nonce.toBigInt(),
          asset,
          id: id.toBigInt(),
          value: value.toBigInt(),
        },
        merkleIndex.toNumber()
      );
    });
  }
}
