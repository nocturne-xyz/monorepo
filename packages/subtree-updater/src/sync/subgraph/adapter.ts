import {
  ClosableAsyncIterator,
  IterSyncOpts,
  sleep,
  fetchNotes,
  IncludedNote,
  IncludedEncryptedNote,
  NoteTrait,
  TreeConstants,
  IncludedNoteCommitment,
  TotalEntityIndex,
} from "@nocturne-xyz/sdk";
import { SubtreeUpdaterSyncAdapter } from "../syncAdapter";
import {
  fetchFilledBatchWithZerosEvents,
  fetchLatestSubtreeIndex,
} from "./fetch";

export class SubgraphSubtreeUpdaterSyncAdapter
  implements SubtreeUpdaterSyncAdapter
{
  private readonly graphqlEndpoint: string;

  constructor(graphqlEndpoint: string) {
    this.graphqlEndpoint = graphqlEndpoint;
  }

  iterInsertions(
    startTotalEntityIndex: TotalEntityIndex,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<IncludedNote | IncludedNoteCommitment> {
    const endpoint = this.graphqlEndpoint;
    const endTotalEntityIndex = opts?.endTotalEntityIndex;

    let closed = false;
    const generator = async function* () {
      let from = startTotalEntityIndex;
      while (!closed && (!endTotalEntityIndex || from < endTotalEntityIndex)) {
        console.log(`fetching insertions from totalEntityIndex ${from} ...`);

        const [notesWithTimestamps, filledBatchWithZerosEvents] =
          await Promise.all([
            fetchNotes(endpoint, from),
            fetchFilledBatchWithZerosEvents(endpoint, from),
          ]);
        const notes = notesWithTimestamps.map(({ inner }) => inner);

        const combined = [...notes, ...filledBatchWithZerosEvents].sort(
          (a, b) => a.merkleIndex - b.merkleIndex
        );

        for (const insertion of combined) {
          if ("numZeros" in insertion) {
            const startIndex = insertion.merkleIndex;
            for (let i = 0; i < insertion.numZeros; i++) {
              yield {
                noteCommitment: TreeConstants.ZERO_VALUE,
                merkleIndex: startIndex + i,
              };
            }
          } else if (NoteTrait.isEncryptedNote(insertion)) {
            console.log(
              "yielding commitment of encrypted note at index",
              insertion.merkleIndex
            );
            yield {
              noteCommitment: (insertion as IncludedEncryptedNote).commitment,
              merkleIndex: insertion.merkleIndex,
            };
          } else {
            console.log("yielding note at index", insertion.merkleIndex);
            yield insertion as IncludedNote;
          }
        }

        from = to + 1;

        if (opts?.throttleMs && latestIndexedBlock - from > chunkSize) {
          await sleep(opts.throttleMs);
        }
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }

  async fetchLatestSubtreeIndex(): Promise<number | undefined> {
    return fetchLatestSubtreeIndex(this.graphqlEndpoint);
  }
}
