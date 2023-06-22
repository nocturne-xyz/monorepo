import {
  ClosableAsyncIterator,
  IterSyncOpts,
  sleep,
  IncludedNote,
  IncludedEncryptedNote,
  NoteTrait,
  TreeConstants,
  TotalEntityIndex,
  maxArray,
  SubgraphUtils,
  TotalEntityIndexTrait,
  max,
  WithTotalEntityIndex,
} from "@nocturne-xyz/sdk";
import { Insertion, SubtreeUpdaterSyncAdapter } from "../syncAdapter";
import { fetchTreeInsertions, fetchLatestSubtreeIndex } from "./fetch";
import { Logger } from "winston";

const { fetchLatestIndexedBlock } = SubgraphUtils;

export class SubgraphSubtreeUpdaterSyncAdapter
  implements SubtreeUpdaterSyncAdapter
{
  private readonly graphqlEndpoint: string;
  private readonly logger?: Logger;

  constructor(graphqlEndpoint: string, logger?: Logger) {
    this.graphqlEndpoint = graphqlEndpoint;
    this.logger = logger;
  }

  iterInsertions(
    startTotalEntityIndex: TotalEntityIndex,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<WithTotalEntityIndex<Insertion>> {
    const endpoint = this.graphqlEndpoint;
    const logger = this.logger;
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
        logger &&
          logger.info("fetching insertions", {
            from,
            fromBlock: TotalEntityIndexTrait.toComponents(from).blockNumber,
          });

        const latestIndexedBlock = await fetchLatestIndexedBlock(endpoint);
        await maybeApplyThrottle(latestIndexedBlock);

        const insertions = await fetchTreeInsertions(endpoint, from);

        const sorted = insertions.sort(
          ({ inner: a }, { inner: b }) => a.merkleIndex - b.merkleIndex
        );

        // if we got insertions, get the greatest total entity index we saw and set from to that plus one
        if (insertions.length > 0) {
          from = maxArray(sorted.map((i) => i.totalEntityIndex)) + 1n;

          for (const { inner: insertion, totalEntityIndex } of sorted) {
            if ("numZeros" in insertion) {
              const startIndex = insertion.merkleIndex;
              const meta = {
                startIndex: startIndex,
                numZeros: insertion.numZeros,
              };
              logger &&
                logger.debug("yielding zeros", {
                  insertionKind: "zeros",
                  insertion: meta,
                });
              for (let i = 0; i < insertion.numZeros; i++) {
                yield {
                  inner: {
                    noteCommitment: TreeConstants.ZERO_VALUE,
                    merkleIndex: startIndex + i,
                  },
                  // HACK: add `i` to `totalEntityIndex` to ensure all of the zeros have unique `totalEntityIndex`s
                  totalEntityIndex: totalEntityIndex + BigInt(i),
                };
              }
            } else if (NoteTrait.isEncryptedNote(insertion)) {
              const noteCommitment = (insertion as IncludedEncryptedNote)
                .commitment;
              const meta = {
                merkleIndex: insertion.merkleIndex,
                noteCommitment,
              };

              logger &&
                logger.debug("yielding encrypted note", {
                  insertionKind: "encrypted note",
                  meta,
                });

              yield {
                inner: {
                  noteCommitment,
                  merkleIndex: insertion.merkleIndex,
                },
                totalEntityIndex,
              };
            } else {
              const meta = {
                merkleIndex: insertion.merkleIndex,
                note: insertion,
              };
              logger &&
                logger.debug("yielding note", {
                  insertionKind: "note",
                  meta,
                });

              yield {
                inner: insertion as IncludedNote,
                totalEntityIndex,
              };
            }
          }
        } else {
          // otherwise, we've caught up and there's nothing more to fetch.
          // set `from` to the entity index corresponding to the latest indexed block
          // if it's greater than the current `from`.

          // this is to prevent an busy loops in the case where the subgraph has indexed a block corresponding
          // to a totalEntityIndex > `endTotalEntityIndex` but we haven't found any insertions in that block
          const currentBlockTotalEntityIndex =
            TotalEntityIndexTrait.fromBlockNumber(latestIndexedBlock);
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
