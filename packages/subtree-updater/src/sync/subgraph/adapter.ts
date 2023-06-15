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
  maxArray,
  SubgraphUtils,
  TotalEntityIndexTrait,
  max,
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

      const maybeApplyThrottle = async (currentBlock: number) => {
        const isCaughtUp =
          from >=
          TotalEntityIndexTrait.fromComponents({
            blockNumber: BigInt(currentBlock),
          });
        const sleepDelay = max(opts?.throttleMs ?? 0, isCaughtUp ? 5000 : 0);
        await sleep(sleepDelay);
      };

      while (!closed && (!endTotalEntityIndex || from < endTotalEntityIndex)) {
        console.log(
          `fetching insertions from totalEntityIndex ${TotalEntityIndexTrait.toStringPadded(
            from
          )} (block ${
            TotalEntityIndexTrait.toComponents(from).blockNumber
          }) ...`
        );

        const currentBlock = await fetchLatestIndexedBlock(endpoint);
        await maybeApplyThrottle(currentBlock);

        const insertions = await fetchTreeInsertions(endpoint, from);

        const sorted = insertions.sort(
          ({ inner: a }, { inner: b }) => a.merkleIndex - b.merkleIndex
        );

        // if we got insertions, get the greatest total entity index we saw and set from to that plus one
        if (insertions.length > 0) {
          from = maxArray(sorted.map((i) => i.totalEntityIndex)) + 1n;

          for (const { inner: insertion } of sorted) {
            if ("numZeros" in insertion) {
              const startIndex = insertion.merkleIndex;
              console.log("yielding zeros", {
                startIndex,
                numZeros: insertion.numZeros,
              });
              for (let i = 0; i < insertion.numZeros; i++) {
                yield {
                  noteCommitment: TreeConstants.ZERO_VALUE,
                  merkleIndex: startIndex + i,
                };
              }
            } else if (NoteTrait.isEncryptedNote(insertion)) {
              console.log("yielding commitment of encrypted note", {
                merkleIndex: insertion.merkleIndex,
              });
              yield {
                noteCommitment: (insertion as IncludedEncryptedNote).commitment,
                merkleIndex: insertion.merkleIndex,
              };
            } else {
              console.log("yielding note", {
                merkleIndex: insertion.merkleIndex,
              });
              yield insertion as IncludedNote;
            }
          }
        } else {
          // otherwise, we've caught up and there's nothing more to fetch.
          // set `from` to the entity index corresponding to the latest indexed block
          // if it's greater than the current `from`.

          // this is to prevent an busy loops in the case where the subgraph has indexed a block corresponding
          // to a totalEntityIndex > `endTotalEntityIndex` but we haven't found any insertions in that block
          const currentBlockTotalEntityIndex =
            TotalEntityIndexTrait.fromComponents({
              blockNumber: BigInt(currentBlock),
            });

          if (currentBlockTotalEntityIndex > from) {
            from = currentBlockTotalEntityIndex;
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
