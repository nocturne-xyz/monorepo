import {
  AssetTrait,
  BaseJoinSplit,
  EncodedAsset,
  IncludedNote,
  Note,
} from "../../primitives";
import {
  RefundProcessedEvent,
  JoinSplitProcessedEvent,
  SubtreeUpdateEvent,
  InsertNoteCommitmentsEvent,
  InsertNoteEvent,
} from "@nocturne-xyz/contracts/dist/src/Handler";
import { Handler } from "@nocturne-xyz/contracts";
import { queryEvents } from "../../utils";

export interface JoinSplitEvent {
  oldNoteANullifier: bigint;
  oldNoteBNullifier: bigint;
  newNoteAIndex: number;
  newNoteBIndex: number;
  joinSplit: BaseJoinSplit;
}

// fetching refunded notes occuring in block range [from, to]
// if `to` > the current block number, will only return up to the current block number
// (this is same behavior as ethers)
export async function fetchNotesFromRefunds(
  contract: Handler,
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

// fetching joinsplits occuring in block range [from, to]
// if `to` > the current block number, will only return up to the current block number
// (this is same behavior as ethers)
export async function fetchJoinSplits(
  contract: Handler,
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

interface SubtreeUpdateCommit {
  newRoot: bigint;
  subtreeIndex: number;
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

  return events.map(({ args: { newRoot, subtreeIndex } }) => ({
    newRoot: newRoot.toBigInt(),
    subtreeIndex: subtreeIndex.toNumber(),
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
  const ncEventsProm: Promise<InsertNoteCommitmentsEvent[]> = queryEvents(
    contract,
    contract.filters.InsertNoteCommitments(),
    from,
    to
  );
  const noteEventsProm: Promise<InsertNoteEvent[]> = queryEvents(
    contract,
    contract.filters.InsertNote(),
    from,
    to
  );

  const [noteCommitmentEvents, noteEvents] = await Promise.all([
    ncEventsProm,
    noteEventsProm,
  ]);

  // extract leaves from each (note commitments are the leaves, full notes have to be hashed)
  // combine them into a single list
  // and sort them in the order in which they appeared on-chain

  let insertions: OrderedInsertion[] = [];
  for (const event of noteCommitmentEvents) {
    const ncs = event.args.commitments.map((l) => l.toBigInt());
    const orderedNoteCommitments = ncs.map((nc) => ({
      insertion: nc,
      blockNumber: event.blockNumber,
      txIdx: event.transactionIndex,
      logIdx: event.logIndex,
    }));
    insertions.push(...orderedNoteCommitments);
  }

  for (const event of noteEvents) {
    const noteValues = event.args.note;

    const owner = {
      h1X: noteValues.ownerH1.toBigInt(),
      h2X: noteValues.ownerH2.toBigInt(),
      h1Y: 0n,
      h2Y: 0n,
    };

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
