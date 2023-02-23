import { Wallet } from "@nocturne-xyz/contracts";
import {
  RefundProcessedEvent,
  JoinSplitProcessedEvent,
} from "@nocturne-xyz/contracts/dist/src/Wallet";
import { IncludedNote } from "../note";
import { queryEvents } from "./utils";
import { JoinSplitEvent } from "../notesManager";
import { AssetTrait, EncodedAsset } from "../asset";

export async function fetchNotesFromRefunds(
  contract: Wallet,
  from: number,
  to: number
): Promise<IncludedNote[]> {
  const filter = contract.filters.RefundProcessed();
  let events: RefundProcessedEvent[] = await queryEvents(
    contract,
    filter,
    from,
    to
  );

  events = events.sort((a, b) => a.blockNumber - b.blockNumber);

  return events.map((event) => {
    const {
      refundAddr,
      nonce,
      encodedAssetAddr,
      encodedAssetId,
      value,
      merkleIndex,
    } = event.args;
    const { h1X, h1Y, h2X, h2Y } = refundAddr;
    const encodedAsset: EncodedAsset = {
      encodedAssetAddr: encodedAssetAddr.toBigInt(),
      encodedAssetId: encodedAssetId.toBigInt(),
    };

    return {
      owner: {
        h1X: h1X.toBigInt(),
        h1Y: h1Y.toBigInt(),
        h2X: h2X.toBigInt(),
        h2Y: h2Y.toBigInt(),
      },
      nonce: nonce.toBigInt(),
      asset: AssetTrait.decode(encodedAsset),
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
  const filter = contract.filters.JoinSplitProcessed();
  let events: JoinSplitProcessedEvent[] = await queryEvents(
    contract,
    filter,
    from,
    to
  );

  events = events.sort((a, b) => a.blockNumber - b.blockNumber);

  // TODO figure out how to do type conversion better
  const newJoinSplits = events.map((event) => {
    const {
      oldNoteANullifier,
      oldNoteBNullifier,
      newNoteAIndex,
      newNoteBIndex,
      joinSplit,
    } = event.args;
    const {
      commitmentTreeRoot,
      nullifierA,
      nullifierB,
      newNoteACommitment,
      newNoteAEncrypted,
      newNoteBCommitment,
      newNoteBEncrypted,
      encodedAsset,
      publicSpend,
    } = joinSplit;
    const { encodedAssetAddr, encodedAssetId } = encodedAsset;
    let { owner, encappedKey, encryptedNonce, encryptedValue } =
      newNoteAEncrypted;
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
      newNoteBEncrypted);
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
      joinSplit: {
        commitmentTreeRoot: commitmentTreeRoot.toBigInt(),
        nullifierA: nullifierA.toBigInt(),
        nullifierB: nullifierB.toBigInt(),
        newNoteACommitment: newNoteACommitment.toBigInt(),
        newNoteAEncrypted: {
          owner: newNoteAOwner,
          encappedKey: encappedKeyA,
          encryptedNonce: encryptedNonceA,
          encryptedValue: encryptedValueA,
        },
        newNoteBCommitment: newNoteBCommitment.toBigInt(),
        newNoteBEncrypted: {
          owner: newNoteBOwner,
          encappedKey: encappedKeyB,
          encryptedNonce: encryptedNonceB,
          encryptedValue: encryptedValueB,
        },
        encodedAsset: {
          encodedAssetAddr: encodedAssetAddr.toBigInt(),
          encodedAssetId: encodedAssetId.toBigInt(),
        },
        publicSpend: publicSpend.toBigInt(),
      },
    };
  });
  return newJoinSplits;
}
