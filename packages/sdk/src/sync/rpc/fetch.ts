import {
  AssetTrait,
  EncodedAsset,
  EncryptedNote,
  IncludedNote,
  Note,
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
): Promise<WithTimestamp<IncludedNote>[]> {
  const filter = contract.filters.RefundProcessed();
  let events: RefundProcessedEvent[] = await queryEvents(
    contract,
    filter,
    from,
    to
  );

  events = events.sort((a, b) => a.blockNumber - b.blockNumber);

  return Promise.all(
    events.map(async (event) => {
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

      const note: IncludedNote = {
        owner,
        nonce: nonce.toBigInt(),
        asset: AssetTrait.decode(encodedAsset),
        value: value.toBigInt(),
        merkleIndex: merkleIndex.toNumber(),
      };

      const block = await event.getBlock();
      const timestampUnixMillis = block.timestamp * 1000;

      return {
        inner: note,
        timestampUnixMillis,
      };
    })
  );
}

// fetching joinsplits occuring in block range [from, to]
// if `to` > the current block number, will only return up to the current block number
// (this is same behavior as ethers)
export async function fetchJoinSplits(
  contract: Handler,
  from: number,
  to: number
): Promise<WithTimestamp<JoinSplitEvent>[]> {
  const filter = contract.filters.JoinSplitProcessed();
  let events: JoinSplitProcessedEvent[] = await queryEvents(
    contract,
    filter,
    from,
    to
  );

  events = events.sort((a, b) => a.blockNumber - b.blockNumber);

  // TODO figure out how to do type conversion better
  return Promise.all(
    events.map(async (event) => {
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
      } = event.args;
      const { encodedAssetAddr, encodedAssetId } = encodedAsset;
      let { owner, encappedKey, encryptedNonce, encryptedValue } =
        newNoteAEncrypted;
      let { h1, h2 } = owner;
      const newNoteAOwner = StealthAddressTrait.decompress({
        h1: h1.toBigInt(),
        h2: h2.toBigInt(),
      });
      const encappedKeyA = encappedKey.toBigInt();
      const encryptedNonceA = encryptedNonce.toBigInt();
      const encryptedValueA = encryptedValue.toBigInt();
      ({ owner, encappedKey, encryptedNonce, encryptedValue } =
        newNoteBEncrypted);
      ({ h1, h2 } = owner);
      const newNoteBOwner = StealthAddressTrait.decompress({
        h1: h1.toBigInt(),
        h2: h2.toBigInt(),
      });
      const encappedKeyB = encappedKey.toBigInt();
      const encryptedNonceB = encryptedNonce.toBigInt();
      const encryptedValueB = encryptedValue.toBigInt();
      const joinSplitEvent = {
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
      };

      const block = await event.getBlock();
      const timestampUnixMillis = block.timestamp * 1000;

      return {
        inner: joinSplitEvent,
        timestampUnixMillis,
      };
    })
  );
}

interface SubtreeUpdateCommit {
  newRoot: bigint;
  subtreeBatchOffset: number;
}

// fetches subtree commits in block range [from, to]
// if `to` > the current block number, will only return up to the current block number
// (this is same behavior as ethers)
export async function fetchSubtreeUpdateCommits(
  contract: Handler,
  from: number,
  to: number
): Promise<SubtreeUpdateCommit[]> {
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

  return events.map(({ args: { newRoot, subtreeBatchOffset } }) => ({
    newRoot: newRoot.toBigInt(),
    subtreeBatchOffset: subtreeBatchOffset.toNumber(),
  }));
}

interface OrderedInsertion {
  insertion: bigint | Note;
  blockNumber: number;
  txIdx: number;
  logIdx: number;
}

// returns SubtreeUpdateCommit events sorted in the order in which they appeared on-chain
export async function fetchInsertions(
  contract: Handler,
  from: number,
  to: number
): Promise<(Note | bigint)[]> {
  // fetch both kind of insertion events (note commitments and full notes)
  const ncEventsProm: Promise<JoinSplitProcessedEvent[]> = queryEvents(
    contract,
    contract.filters.JoinSplitProcessed(),
    from,
    to
  );
  const noteEventsProm: Promise<RefundProcessedEvent[]> = queryEvents(
    contract,
    contract.filters.RefundProcessed(),
    from,
    to
  );

  const [noteCommitmentEvents, notesEvents] = await Promise.all([
    ncEventsProm,
    noteEventsProm,
  ]);

  // extract leaves from each (note commitments are the leaves, full notes have to be hashed)
  // combine them into a single list
  // and sort them in the order in which they appeared on-chain

  let insertions: OrderedInsertion[] = [];
  for (const event of noteCommitmentEvents) {
    const newNcA = event.args.newNoteACommitment.toBigInt();
    const newNcB = event.args.newNoteBCommitment.toBigInt();

    const orderedNoteCommitments = [newNcA, newNcB].map((nc) => ({
      insertion: nc,
      blockNumber: event.blockNumber,
      txIdx: event.transactionIndex,
      logIdx: event.logIndex,
    }));
    insertions.push(...orderedNoteCommitments);
  }

  for (const event of notesEvents) {
    const noteValues = event.args;
    const h1 = noteValues.refundAddr.h1.toBigInt();
    const h2 = noteValues.refundAddr.h2.toBigInt();
    const owner = StealthAddressTrait.decompress({ h1, h2 });

    const encoddAsset: EncodedAsset = {
      encodedAssetAddr: noteValues.encodedAssetAddr.toBigInt(),
      encodedAssetId: noteValues.encodedAssetId.toBigInt(),
    };

    const asset = AssetTrait.decode(encoddAsset);

    const note: Note = {
      owner,
      nonce: noteValues.nonce.toBigInt(),
      asset,
      value: noteValues.value.toBigInt(),
    };

    insertions.push({
      insertion: note,
      blockNumber: event.blockNumber,
      txIdx: event.transactionIndex,
      logIdx: event.logIndex,
    });
  }

  insertions = insertions.sort(
    (a, b) =>
      a.blockNumber - b.blockNumber || a.txIdx - b.txIdx || a.logIdx - b.logIdx
  );

  return insertions.map(({ insertion }) => insertion);
}
