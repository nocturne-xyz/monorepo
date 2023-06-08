import {
  AssetTrait,
  EncodedAsset,
  EncryptedNote,
  IncludedNote,
  WithTimestamp,
} from "../../primitives";
import {
  RefundProcessedEvent,
  JoinSplitProcessedEvent,
  SubtreeUpdateEvent,
} from "@nocturne-xyz/contracts/dist/src/Handler";
import { Handler } from "@nocturne-xyz/contracts";
import { queryEvents } from "../../utils";
import { StealthAddressTrait } from "../../crypto";
import {
  TotalEntityIndexTrait,
  WithTotalEntityIndex,
} from "../totalEntityIndex";

export interface SubtreeUpdateCommit {
  newRoot: bigint;
  subtreeBatchOffset: number;
}

export interface JoinSplitEvent {
  oldNoteANullifier: bigint;
  oldNoteBNullifier: bigint;
  newNoteAIndex: number;
  newNoteBIndex: number;
  newNoteACommitment: bigint;
  newNoteBCommitment: bigint;
  encodedAsset: EncodedAsset;
  publicSpend: bigint;
  newNoteAEncrypted: EncryptedNote;
  newNoteBEncrypted: EncryptedNote;
}

// fetching refunded notes occuring in block range [from, to]
// if `to` > the current block number, will only return up to the current block number
// (this is same behavior as ethers)
export async function fetchNotesFromRefunds(
  contract: Handler,
  from: number,
  to: number
): Promise<WithTotalEntityIndex<WithTimestamp<IncludedNote>>[]> {
  const filter = contract.filters.RefundProcessed();
  let events: RefundProcessedEvent[] = await queryEvents(
    contract,
    filter,
    from,
    to
  );

  events = events.sort((a, b) => a.blockNumber - b.blockNumber);

  return Promise.all(events.map(async (event) => refundNoteFromEvent(event)));
}

// fetching joinsplits occuring in block range [from, to]
// if `to` > the current block number, will only return up to the current block number
// (this is same behavior as ethers)
export async function fetchJoinSplits(
  contract: Handler,
  from: number,
  to: number
): Promise<WithTotalEntityIndex<WithTimestamp<JoinSplitEvent>>[]> {
  const filter = contract.filters.JoinSplitProcessed();
  let events: JoinSplitProcessedEvent[] = await queryEvents(
    contract,
    filter,
    from,
    to
  );

  events = events.sort((a, b) => a.blockNumber - b.blockNumber);

  // TODO figure out how to do type conversion better
  return Promise.all(events.map(async (event) => joinSplitEventFromRaw(event)));
}

// fetches subtree commits in block range [from, to]
// if `to` > the current block number, will only return up to the current block number
// (this is same behavior as ethers)
export async function fetchSubtreeUpdateCommits(
  contract: Handler,
  from: number,
  to: number
): Promise<WithTotalEntityIndex<SubtreeUpdateCommit>[]> {
  const subtreeUpdateEventsFilter = contract.filters.SubtreeUpdate();
  let events: SubtreeUpdateEvent[] = await queryEvents(
    contract,
    subtreeUpdateEventsFilter,
    from,
    to
  );

  events = events.sort(
    (a, b) =>
      a.blockNumber - b.blockNumber ||
      a.transactionIndex - b.transactionIndex ||
      a.logIndex - b.logIndex
  );

  return events.map((event) => ({
    totalEntityIndex: TotalEntityIndexTrait.fromTypedEvent(event),
    inner: {
      newRoot: event.args.newRoot.toBigInt(),
      subtreeBatchOffset: event.args.subtreeBatchOffset.toNumber(),
    },
  }));
}

async function joinSplitEventFromRaw(
  raw: JoinSplitProcessedEvent
): Promise<WithTotalEntityIndex<WithTimestamp<JoinSplitEvent>>> {
  const {
    oldNoteANullifier,
    oldNoteBNullifier,
    newNoteAIndex,
    newNoteBIndex,
    newNoteACommitment,
    newNoteAEncrypted,
    newNoteBCommitment,
    newNoteBEncrypted,
    encodedAsset,
    publicSpend,
  } = raw.args;
  const { encodedAssetAddr, encodedAssetId } = encodedAsset;
  let { owner, encappedKey, encryptedNonce, encryptedValue } =
    newNoteAEncrypted;
  let { h1, h2 } = owner;
  const newNoteAOwner = {
    h1: h1.toBigInt(),
    h2: h2.toBigInt(),
  };
  const encappedKeyA = encappedKey.toBigInt();
  const encryptedNonceA = encryptedNonce.toBigInt();
  const encryptedValueA = encryptedValue.toBigInt();
  ({ owner, encappedKey, encryptedNonce, encryptedValue } = newNoteBEncrypted);
  ({ h1, h2 } = owner);
  const newNoteBOwner = {
    h1: h1.toBigInt(),
    h2: h2.toBigInt(),
  };
  const encappedKeyB = encappedKey.toBigInt();
  const encryptedNonceB = encryptedNonce.toBigInt();
  const encryptedValueB = encryptedValue.toBigInt();

  const block = await raw.getBlock();
  const timestampUnixMillis = block.timestamp * 1000;

  return {
    totalEntityIndex: TotalEntityIndexTrait.fromTypedEvent(raw),
    inner: {
      timestampUnixMillis,
      inner: {
        oldNoteANullifier: oldNoteANullifier.toBigInt(),
        oldNoteBNullifier: oldNoteBNullifier.toBigInt(),
        newNoteAIndex: newNoteAIndex.toNumber(),
        newNoteBIndex: newNoteBIndex.toNumber(),
        newNoteACommitment: newNoteACommitment.toBigInt(),
        newNoteBCommitment: newNoteBCommitment.toBigInt(),
        encodedAsset: {
          encodedAssetAddr: encodedAssetAddr.toBigInt(),
          encodedAssetId: encodedAssetId.toBigInt(),
        },
        publicSpend: publicSpend.toBigInt(),
        newNoteAEncrypted: {
          owner: newNoteAOwner,
          encappedKey: encappedKeyA,
          encryptedNonce: encryptedNonceA,
          encryptedValue: encryptedValueA,
        },
        newNoteBEncrypted: {
          owner: newNoteBOwner,
          encappedKey: encappedKeyB,
          encryptedNonce: encryptedNonceB,
          encryptedValue: encryptedValueB,
        },
      },
    },
  };
}

async function refundNoteFromEvent(
  event: RefundProcessedEvent
): Promise<WithTotalEntityIndex<WithTimestamp<IncludedNote>>> {
  const {
    refundAddr,
    nonce,
    encodedAssetAddr,
    encodedAssetId,
    value,
    merkleIndex,
  } = event.args;

  const { h1, h2 } = refundAddr;
  const encodedAsset: EncodedAsset = {
    encodedAssetAddr: encodedAssetAddr.toBigInt(),
    encodedAssetId: encodedAssetId.toBigInt(),
  };

  const owner = StealthAddressTrait.decompress({
    h1: h1.toBigInt(),
    h2: h2.toBigInt(),
  });

  const block = await event.getBlock();
  const timestampUnixMillis = block.timestamp * 1000;

  return {
    totalEntityIndex: TotalEntityIndexTrait.fromTypedEvent(event),
    inner: {
      timestampUnixMillis,
      inner: {
        owner,
        nonce: nonce.toBigInt(),
        asset: AssetTrait.decode(encodedAsset),
        value: value.toBigInt(),
        merkleIndex: merkleIndex.toNumber(),
      },
    },
  };
}
