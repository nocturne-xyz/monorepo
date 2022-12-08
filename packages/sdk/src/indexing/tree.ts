import { Wallet } from "@nocturne-xyz/contracts";
import {
  InsertNoteCommitmentsEvent,
  InsertNotesEvent,
  SubtreeUpdateEvent,
} from "@nocturne-xyz/contracts/dist/src/Wallet";
import { query } from "../sdk/utils";
import { Note } from "../sdk/note";

interface OrderedInsertion {
  insertion: bigint | Note;
  blockNumber: number;
  txIdx: number;
  logIdx: number;
}

export async function fetchInsertions(
  contract: Wallet,
  from: number,
  to: number
): Promise<(Note | bigint)[]> {
  // fetch both kind of insertion events (note commitments and full notes)
  const ncEventsProm: Promise<InsertNoteCommitmentsEvent[]> = query(
    contract,
    contract.filters.InsertNoteCommitments(),
    from,
    to
  );
  const noteEventsProm: Promise<InsertNotesEvent[]> = query(
    contract,
    contract.filters.InsertNotes(),
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
    for (const noteValues of event.args.notes) {
      const owner = {
        h1X: noteValues.ownerH1.toBigInt(),
        h2X: noteValues.ownerH2.toBigInt(),
        h1Y: 0n,
        h2Y: 0n,
      };

      const note: Note = {
        owner,
        nonce: noteValues.nonce.toBigInt(),
        asset: noteValues.asset.toHexString(),
        id: noteValues.id.toBigInt(),
        value: noteValues.value.toBigInt(),
      };

      insertions.push({
        insertion: note,
        blockNumber: event.blockNumber,
        txIdx: event.transactionIndex,
        logIdx: event.logIndex,
      });
    }
  }

  insertions = insertions.sort(
    (a, b) =>
      a.blockNumber - b.blockNumber || a.txIdx - b.txIdx || a.logIdx - b.logIdx
  );
  return insertions.map(({ insertion }) => insertion);
}

export interface SubtreeUpdateCommit {
  newRoot: bigint;
  subtreeIndex: number;
}

export async function fetchSubtreeUpdateCommits(
  contract: Wallet,
  from: number,
  to: number
): Promise<SubtreeUpdateCommit[]> {
  const subtreeUpdateEventsFilter = contract.filters.SubtreeUpdate();
  const events: SubtreeUpdateEvent[] = await query(
    contract,
    subtreeUpdateEventsFilter,
    from,
    to
  );

  const eventValues = events.map((event) => event.args);
  eventValues.sort(
    (a, b) => a.subtreeIndex.toNumber() - b.subtreeIndex.toNumber()
  );

  return eventValues.map((event) => ({
    newRoot: event.newRoot.toBigInt(),
    subtreeIndex: event.subtreeIndex.toNumber(),
  }));
}
