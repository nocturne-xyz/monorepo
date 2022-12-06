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
import { IncludedNote } from "../note";

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

  async fetchNotesFromRefunds(): Promise<IncludedNote[]> {
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

    // TODO figure out how to do type conversion better
    const newJoinSplits = events.map((event) => {
      const {
        oldNoteANullifier,
        oldNoteBNullifier,
        newNoteAIndex,
        newNoteBIndex,
        joinSplitTx,
      } = event.args;
      const {
        commitmentTreeRoot,
        nullifierA,
        nullifierB,
        newNoteACommitment,
        newNoteATransmission,
        newNoteBCommitment,
        newNoteBTransmission,
        asset,
        id,
        publicSpend,
      } = joinSplitTx;
      let { owner, encappedKey, encryptedNonce, encryptedValue } =
        newNoteATransmission;
      let { h1X, h1Y, h2X, h2Y } = owner;
      const newNoteAOwner = {
        h1X: h1X.toBigInt(),
        h1Y: h1Y.toBigInt(),
        h2X: h2X.toBigInt(),
        h2Y: h2Y.toBigInt(),
      };
      const encappedKeyA = encappedKey.toBigInt();
      const encryptedNonceA = encryptedNonce.toBigInt();
      const encryptedValueA = encryptedValue.toBigInt();
      ({ owner, encappedKey, encryptedNonce, encryptedValue } =
        newNoteBTransmission);
      ({ h1X, h1Y, h2X, h2Y } = owner);
      const newNoteBOwner = {
        h1X: h1X.toBigInt(),
        h1Y: h1Y.toBigInt(),
        h2X: h2X.toBigInt(),
        h2Y: h2Y.toBigInt(),
      };
      const encappedKeyB = encappedKey.toBigInt();
      const encryptedNonceB = encryptedNonce.toBigInt();
      const encryptedValueB = encryptedValue.toBigInt();
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
          newNoteATransmission: {
            owner: newNoteAOwner,
            encappedKey: encappedKeyA,
            encryptedNonce: encryptedNonceA,
            encryptedValue: encryptedValueA,
          },
          newNoteBCommitment: newNoteBCommitment.toBigInt(),
          newNoteBTransmission: {
            owner: newNoteBOwner,
            encappedKey: encappedKeyB,
            encryptedNonce: encryptedNonceB,
            encryptedValue: encryptedValueB,
          },
          asset,
          id: id.toBigInt(),
          publicSpend: publicSpend.toBigInt(),
        },
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
