import { IncludedNote } from "../sdk";
import { Wallet } from "@nocturne-xyz/contracts";
import { query } from "../sdk/utils";
import { JoinSplitEvent } from "../sdk/notesManager";
import {
  RefundEvent as EthRefundEvent,
  JoinSplitEvent as EthJoinSplitEvent,
} from "@nocturne-xyz/contracts/dist/src/Wallet";
import request from 'graphql-request';
import { gql } from 'graphql';
import { NoteTransmission, decodeAsset } from "../commonTypes";

const blockNumberToId = (blockNumber: bigint) => "0x" + (blockNumber << 64n).toString(16).padStart(192, '0');
const SUBGRAPH_ENDPOINT = "https://api.goldsky.com/api/public/project_cldkt6zd6wci33swq4jkh6x2w/subgraphs/nocturne-test/0.0.6/gn";

const fetchNotesQuery = gql`
  query fetchNotes($fromId: Bytes, $toId: Bytes) {
    encodedOrEncryptedNotes(first: 20, where: { id_gt: $fromId, id_lt: $toId }) {
      merkleIndex
      note {
        ownerH1
        ownerH2
        nonce
        encodedAssetAddr
        encodedAssetId
        value
      }
      encryptedNote {
        id
        ownerH1X
        ownerH2X
        encappedKey
        encryptedNonce
        encryptedValue
        encodedAssetAddr
        encodedAssetId
        commitment
      }
    }
  }
`;

export interface IncludedNoteOrNoteTransmission {
  merkleIndex: bigint;
  noteOrNoteTransmission: IncludedNote | NoteTransmission;
}

export async function fetchNotes(contract: Wallet, from: number, to: number): Promise<IncludedNoteOrNoteTransmission[]> {
  const data = await request(
    SUBGRAPH_ENDPOINT,
    fetchNotesQuery,
    {
      fromId: blockNumberToId(BigInt(from)),
      toId: blockNumberToId(BigInt(to)),
    }
  );
  console.log(data);

  return [];
}

export async function fetchNotesFromRefunds(
  contract: Wallet,
  from: number,
  to: number
): Promise<IncludedNote[]> {

  await fetchNotes(contract, from, to);

  const filter = contract.filters.Refund();
  let events: EthRefundEvent[] = await query(contract, filter, from, to);

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
    return {
      owner: {
        h1X: h1X.toBigInt(),
        h1Y: h1Y.toBigInt(),
        h2X: h2X.toBigInt(),
        h2Y: h2Y.toBigInt(),
      },
      nonce: nonce.toBigInt(),
      asset: decodeAsset(
        encodedAssetAddr.toBigInt(),
        encodedAssetId.toBigInt()
      ),
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
      encodedAsset,
      publicSpend,
    } = joinSplitTx;
    const { encodedAssetAddr, encodedAssetId } = encodedAsset;
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
