import { Wallet, Wallet__factory } from "@nocturne-xyz/contracts";
import { ethers } from "ethers";
import { Address } from "../../commonTypes";
import { NocturneDB } from "../db";
import { query } from "../utils";
import {
  RefundEvent as EthRefundEvent,
  JoinSplitEvent as EthJoinSplitEvent,
} from "@nocturne-xyz/contracts/dist/src/Wallet";
import { NotesManager, JoinSplitEvent } from ".";
import { NocturneSigner } from "../signer";
import { IncludedNoteStruct, EncryptedNote } from "../note";

const DEFAULT_START_BLOCK = 0;
const REFUNDS_LAST_INDEXED_BLOCK = "REFUNDS_LAST_INDEXED_BLOCK";
const REFUNDS_TENTATIVE_LAST_INDEXED_BLOCK =
  "REFUNDS_TENTATIVE_LAST_INDEXED_BLOCK";
const JOINSPLITS_LAST_INDEXED_BLOCK = "JOINSPLITS_LAST_INDEXED_BLOCK";
const JOINSPLITS_TENTATIVE_LAST_INDEXED_BLOCK =
  "JOINSPLITS_TENTATIVE_LAST_INDEXED_BLOCK";

export class LocalNotesManager extends NotesManager {
  walletContract: Wallet;
  provider: ethers.providers.Provider;

  constructor(
    db: NocturneDB,
    signer: NocturneSigner,
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

  async fetchJoinSplits(): Promise<JoinSplitEvent[]> {
    // TODO: load default from network-specific config
    const lastSeen =
      (await this.db.getNumberKv(JOINSPLITS_LAST_INDEXED_BLOCK)) ??
      DEFAULT_START_BLOCK;
    const latestBlock = await this.provider.getBlockNumber();

    const filter = this.walletContract.filters.JoinSplit();
    let events: EthJoinSplitEvent[] = await query(
      this.walletContract,
      filter,
      lastSeen,
      latestBlock
    );

    events = events.sort((a, b) => a.blockNumber - b.blockNumber);

    const newJoinSplits = events.map((event) => {
      console.log(event);
      const {
        oldNoteANullifier,
        oldNoteBNullifier,
        newNoteAIndex,
        newNoteBIndex,
        joinSplitTx
      } = event.args;
      const {
        commitmentTreeRoot,
        nullifierA,
        nullifierB,
        newNoteACommitment,
        newNoteAOwner,
        encappedKeyA,
        encryptedNoteA,
        newNoteBCommitment,
        newNoteBOwner,
        encappedKeyB,
        encryptedNoteB,
        asset,
        id,
        publicSpend
      } = joinSplitTx;
      let { h1X, h1Y, h2X, h2Y } = newNoteAOwner;
      const newNoteAOwnerBigInt = {
        h1X: h1X.toBigInt(),
        h1Y: h1Y.toBigInt(),
        h2X: h2X.toBigInt(),
        h2Y: h2Y.toBigInt()
      };
      ({ h1X, h1Y, h2X, h2Y } = newNoteBOwner);
      const newNoteBOwnerBigInt = {
        h1X: h1X.toBigInt(),
        h1Y: h1Y.toBigInt(),
        h2X: h2X.toBigInt(),
        h2Y: h2Y.toBigInt()
      };
      const encryptedNoteABigInt: EncryptedNote = [
        encryptedNoteA[0].toBigInt(),
        encryptedNoteA[1].toBigInt()
      ];
      const encryptedNoteBBigInt: EncryptedNote = [
        encryptedNoteB[0].toBigInt(),
        encryptedNoteB[1].toBigInt()
      ];
      return {
        oldNoteANullifier: oldNoteANullifier.toBigInt(),
        oldNoteBNullifier: oldNoteBNullifier.toBigInt(),
        newNoteAIndex: newNoteAIndex.toNumber(),
        newNoteBIndex: newNoteBIndex.toNumber(),
        joinSplitTx: {
          commitmentTreeRoot: commitmentTreeRoot.toBigInt(),
          nullifierA: nullifierA.toBigInt(),
          nullifierB: nullifierB.toBigInt(),
          newNoteACommitment: newNoteACommitment.toBigInt(),
          newNoteAOwner: newNoteAOwnerBigInt,
          encappedKeyA: encappedKeyA.toBigInt(),
          encryptedNoteA: encryptedNoteABigInt,
          newNoteBCommitment: newNoteBCommitment.toBigInt(),
          newNoteBOwner: newNoteBOwnerBigInt,
          encappedKeyB: encappedKeyB.toBigInt(),
          encryptedNoteB: encryptedNoteBBigInt,
          asset,
          id: id.toBigInt(),
          publicSpend: publicSpend.toBigInt()
        }
      };
    });

    await this.db.putKv(
      JOINSPLITS_TENTATIVE_LAST_INDEXED_BLOCK,
      latestBlock.toString()
    );
    return newJoinSplits;
  }

  async postApplyJoinSplits(): Promise<void> {
    const tentativeLastSeen = await this.db.getKv(
      JOINSPLITS_TENTATIVE_LAST_INDEXED_BLOCK
    );

    if (!tentativeLastSeen) {
      throw new Error(
        "Should never call `postApplyJoinSplits` without having stored a tentative last seen block"
      );
    }

    await this.db.putKv(JOINSPLITS_LAST_INDEXED_BLOCK, tentativeLastSeen);
  }
}
