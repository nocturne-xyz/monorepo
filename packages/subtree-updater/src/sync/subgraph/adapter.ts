import {
  ClosableAsyncIterator,
  IterSyncOpts,
  sleep,
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
import { fetchTreeInsertions, fetchLatestSubtreeIndex } from "./fetch";

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
      const loopCond = () =>
        !closed && (!endTotalEntityIndex || from < endTotalEntityIndex);
      while (loopCond()) {
        console.debug(
          `fetching insertions from totalEntityIndex ${TotalEntityIndexTrait.toStringPadded(
            from
          )} (block ${
            TotalEntityIndexTrait.toComponents(from).blockNumber
          }) ...`
        );
        const currentBlock = await fetchLatestIndexedBlock(endpoint);
        // if we're caught up, wait for a bit and try again
        if (
          from >
          TotalEntityIndexTrait.fromComponents({
            blockNumber: BigInt(currentBlock),
          })
        ) {
          await sleep(5000);
          continue;
        }

        const insertions = await fetchTreeInsertions(endpoint, from);
        const sorted = insertions.sort(
          ({ inner: a }, { inner: b }) => a.merkleIndex - b.merkleIndex
        );

        // if we got insertions, get the greatest total entity index we saw and set from to that plus one
        if (insertions.length > 0) {
          from = maxArray(pluck(sorted, "totalEntityIndex")) + 1n;

          for (const { inner: insertion } of sorted) {
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
        } else {
          // otherwise, we've caught up and there's nothing more to fetch.
          // set `from` to the entity index corresponding to the latest indexed block
          from =
            TotalEntityIndexTrait.fromComponents({
              blockNumber: BigInt(currentBlock),
            }) + 1n;
        }

        // if we're gonna do another iteration, apply the throttle
        if (opts?.throttleMs && loopCond()) {
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
