import { OffchainMerkleTree } from "@flax/contracts";
import { InsertNoteCommitmentsEvent, InsertNotesEvent } from "@flax/contracts/dist/src/OffchainMerkleTree";
import { query } from "../utils";
import { Note } from "../note";

export async function fetchInsertions(contract: OffchainMerkleTree, from: number, to: number): Promise<(Note | bigint)[]> {
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

  const [noteCommitmentEvents, noteEvents] = await Promise.all([ncEventsProm, noteEventsProm]);

  // extract leaves from each (note commitments are the leaves, full notes have to be hashed)
  // combine them into a single list
  // and sort them in the order in which they appeared on-chain

  interface OrderedInsertion {
    insertion: bigint | Note,
    blockNumber: number,
    txIdx: number,
    logIdx: number
  }

  let insertions: OrderedInsertion[] = [];
  for (const event of noteCommitmentEvents) {
      const ncs = event.args.commitments.map((l) => l.toBigInt());
      const orderedNoteCommitments = ncs.map(nc => ({
        insertion :nc,
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

			const noteStruct = {
				owner,
				nonce: noteValues.nonce.toBigInt(),
				asset: noteValues.asset.toHexString(),
				id: noteValues.id.toBigInt(),
				value: noteValues.value.toBigInt(),
			};

			const note = new Note(noteStruct);
			insertions.push({
				insertion: note,
				blockNumber: event.blockNumber,
				txIdx: event.transactionIndex,
				logIdx: event.logIndex,
			});
		}
  }

  insertions = insertions.sort((a, b) => a.blockNumber - b.blockNumber || a.txIdx - b.txIdx || a.logIdx - b.logIdx);
	return insertions.map(({ insertion }) => insertion);
}