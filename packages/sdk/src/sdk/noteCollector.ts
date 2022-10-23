import { Wallet, Wallet__factory } from "@flax/contracts";
import { ethers } from "ethers";
import { Address } from "../commonTypes";
import { Note } from "./note";

export interface NoteCollector {
  gatherReturnedNotes(startBlock: number, endBlock?: number): Note[];
}

export class LocalNoteIndexer implements NoteCollector {
  wallet: Wallet;

  constructor(walletAddress: Address, rpcUrl: string) {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.wallet = Wallet__factory.connect(walletAddress, provider);
  }

  gatherReturnedNotes(startBlock: number, endBlock?: number): Note[] {
    return [];
  }
}
