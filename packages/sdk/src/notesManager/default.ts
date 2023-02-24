import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import {
  Address,
  IncludedNote,
  NocturneViewer,
} from "@nocturne-xyz/primitives";
import { NotesDB } from "../db";
import { NotesManager, JoinSplitEvent } from ".";
import { fetchJoinSplits, fetchNotesFromRefunds } from "../indexing";

const DEFAULT_START_BLOCK = 0;
const REFUNDS_LAST_INDEXED_BLOCK = "REFUNDS_LAST_INDEXED_BLOCK";
const REFUNDS_TENTATIVE_LAST_INDEXED_BLOCK =
  "REFUNDS_TENTATIVE_LAST_INDEXED_BLOCK";
const JOINSPLITS_LAST_INDEXED_BLOCK = "JOINSPLITS_LAST_INDEXED_BLOCK";
const JOINSPLITS_TENTATIVE_LAST_INDEXED_BLOCK =
  "JOINSPLITS_TENTATIVE_LAST_INDEXED_BLOCK";

export interface DefaultNotesManagerOpts {
  startBlock?: number;
}

export class DefaultNotesManager extends NotesManager {
  walletContract: Wallet;
  provider: ethers.providers.Provider;
  startBlock: number;

  constructor(
    db: NotesDB,
    viewer: NocturneViewer,
    walletAddress: Address,
    provider: ethers.providers.Provider,
    opts?: DefaultNotesManagerOpts
  ) {
    super(db, viewer);
    this.provider = provider;
    this.walletContract = Wallet__factory.connect(walletAddress, this.provider);
    this.startBlock = opts?.startBlock ?? DEFAULT_START_BLOCK;
  }

  async fetchNotesFromRefunds(): Promise<IncludedNote[]> {
    // TODO: load default from network-specific config
    const lastSeen =
      (await this.db.kv.getNumber(REFUNDS_LAST_INDEXED_BLOCK)) ??
      this.startBlock;
    const latestBlock = await this.provider.getBlockNumber();

    console.log("Fetching notes from refunds...");
    const newRefunds = await fetchNotesFromRefunds(
      this.walletContract,
      lastSeen,
      latestBlock
    );
    console.log("Fetched notes from refunds:", newRefunds);

    await this.db.kv.putNumber(
      REFUNDS_TENTATIVE_LAST_INDEXED_BLOCK,
      latestBlock
    );
    return newRefunds;
  }

  async postStoreNotesFromRefunds(): Promise<void> {
    const tentativeLastSeen = await this.db.kv.getNumber(
      REFUNDS_TENTATIVE_LAST_INDEXED_BLOCK
    );

    if (!tentativeLastSeen) {
      throw new Error(
        "Should never call `postStoreNotesFromRefunds` without having stored a tentative last seen block"
      );
    }

    await this.db.kv.putNumber(REFUNDS_LAST_INDEXED_BLOCK, tentativeLastSeen);
  }

  async fetchJoinSplits(): Promise<JoinSplitEvent[]> {
    // TODO: load default from network-specific config
    const lastSeen =
      (await this.db.kv.getNumber(JOINSPLITS_LAST_INDEXED_BLOCK)) ??
      this.startBlock;
    const latestBlock = await this.provider.getBlockNumber();

    const newJoinSplits = await fetchJoinSplits(
      this.walletContract,
      lastSeen,
      latestBlock
    );

    await this.db.kv.putNumber(
      JOINSPLITS_TENTATIVE_LAST_INDEXED_BLOCK,
      latestBlock
    );
    return newJoinSplits;
  }

  async postApplyJoinSplits(): Promise<void> {
    const tentativeLastSeen = await this.db.kv.getNumber(
      JOINSPLITS_TENTATIVE_LAST_INDEXED_BLOCK
    );

    if (!tentativeLastSeen) {
      throw new Error(
        "Should never call `postApplyJoinSplits` without having stored a tentative last seen block"
      );
    }

    await this.db.kv.putNumber(
      JOINSPLITS_LAST_INDEXED_BLOCK,
      tentativeLastSeen
    );
  }
}
