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
  pluck,
  maxArray,
  SubgraphUtils,
  TotalEntityIndexTrait,
} from "@nocturne-xyz/sdk";
import { SubtreeUpdaterSyncAdapter } from "../syncAdapter";
import {
  fetchFilledBatchWithZerosEvents,
  fetchLatestSubtreeIndex,
} from "./fetch";

const { fetchLatestIndexedBlock } = SubgraphUtils;

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
        console.debug(
          `fetching insertions from totalEntityIndex ${TotalEntityIndexTrait.toStringPadded(
            from
          )} (block ${
            TotalEntityIndexTrait.toComponents(from).blockNumber
          }) ...`
        );
        const currentBlock = await fetchLatestIndexedBlock(endpoint);

        const [notes, filledBatchWithZerosEvents] = await Promise.all([
          fetchNotes(endpoint, from),
          fetchFilledBatchWithZerosEvents(endpoint, from),
        ]);

        const combinedWithEntityIndices = [
          ...notes,
          ...filledBatchWithZerosEvents,
        ];
        const combined = pluck(combinedWithEntityIndices, "inner").sort(
          (a, b) => a.merkleIndex - b.merkleIndex
        );

        // if we got insertions, get the greatest total entity index we saw and set from to that plus one
        if (combined.length > 0) {
          from =
            maxArray(pluck(combinedWithEntityIndices, "totalEntityIndex")) + 1n;
        } else {
          // otherwise, we've caught up and there's nothing more to fetch.
          // set `from` to the entity index corresponding to the latest indexed block, sleep for a bit, and try again
          from = TotalEntityIndexTrait.fromComponents({
            blockNumber: BigInt(currentBlock),
          });
          await sleep(5_000);
          continue;
        }

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
            console.debug(
              "yielding commitment of encrypted note at index",
              insertion.merkleIndex
            );
            yield {
              noteCommitment: (insertion as IncludedEncryptedNote).commitment,
              merkleIndex: insertion.merkleIndex,
            };
          } else {
            console.debug("yielding note at index", insertion.merkleIndex);
            yield insertion as IncludedNote;
          }
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
