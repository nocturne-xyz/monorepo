import { IncludedNote } from "../sdk";
import { Wallet } from "@nocturne-xyz/contracts";
import { query } from "../sdk/utils";
import { JoinSplitEvent } from "../sdk/notesManager";
import {
  RefundEvent as EthRefundEvent,
  JoinSplitEvent as EthJoinSplitEvent,
} from "@nocturne-xyz/contracts/dist/src/Wallet";

export async function fetchNotesFromRefunds(
  contract: Wallet,
  from: number,
  to: number
): Promise<IncludedNote[]> {
  const filter = contract.filters.Refund();
  let events: EthRefundEvent[] = await query(contract, filter, from, to);

  events = events.sort((a, b) => a.blockNumber - b.blockNumber);

  return events.map((event) => {
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
}

export async function fetchJoinSplits(
  contract: Wallet,
  from: number,
  to: number
): Promise<JoinSplitEvent[]> {
  const filter = contract.filters.JoinSplit();
  let events: EthJoinSplitEvent[] = await query(contract, filter, from, to);

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
    let {
      owner,
      encappedKey,
      encryptedNonce,
      encryptedValue,
      encryptedCounterParty,
      encryptedMemo,
    } = newNoteATransmission;
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
    const encryptedCounterPartyA = encryptedCounterParty.toBigInt();
    const encryptedMemoA = encryptedMemo.toBigInt();
    ({
      owner,
      encappedKey,
      encryptedNonce,
      encryptedValue,
      encryptedCounterParty,
      encryptedMemo,
    } = newNoteBTransmission);
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
    const encryptedCounterPartyB = encryptedCounterParty.toBigInt();
    const encryptedMemoB = encryptedMemo.toBigInt();
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
          encryptedCounterParty: encryptedCounterPartyA,
          encryptedMemo: encryptedMemoA,
        },
        newNoteBCommitment: newNoteBCommitment.toBigInt(),
        newNoteBTransmission: {
          owner: newNoteBOwner,
          encappedKey: encappedKeyB,
          encryptedNonce: encryptedNonceB,
          encryptedValue: encryptedValueB,
          encryptedCounterParty: encryptedCounterPartyB,
          encryptedMemo: encryptedMemoB,
        },
        asset,
        id: id.toBigInt(),
        publicSpend: publicSpend.toBigInt(),
      },
    };
  });

  return newJoinSplits;
}
