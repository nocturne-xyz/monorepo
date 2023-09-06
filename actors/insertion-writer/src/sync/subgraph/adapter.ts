import {
  ClosableAsyncIterator,
  IterSyncOpts,
  sleep,
  IncludedNote,
  IncludedEncryptedNote,
  NoteTrait,
  TreeConstants,
  maxArray,
  SubgraphUtils,
  TotalEntityIndexTrait,
  max,
  range,
} from "@nocturne-xyz/core";
import { TreeInsertionSyncAdapter } from "../syncAdapter";
import { fetchTreeInsertions } from "./fetch";
import { Logger } from "winston";
import { fetchTeiFromMerkleIndex } from "../../utils";
import { Insertion } from "@nocturne-xyz/persistent-log";

const { fetchLatestIndexedBlock } = SubgraphUtils;

export class SubgraphTreeInsertionSyncAdapter
  implements TreeInsertionSyncAdapter
{
  private readonly graphqlEndpoint: string;
  private readonly logger?: Logger;

  constructor(graphqlEndpoint: string, logger?: Logger) {
    this.graphqlEndpoint = graphqlEndpoint;
    this.logger = logger;
  }

  iterInsertions(
    startMerkleIndex: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<Insertion[]> {
    const endpoint = this.graphqlEndpoint;
    const logger = this.logger;
    const endTotalEntityIndex = opts?.endTotalEntityIndex;

    let closed = false;
    const generator = async function* () {
      // figure out what TEI to start polling the subggraph at
      const _from =
        startMerkleIndex === 0
          ? 0n
          : await fetchTeiFromMerkleIndex(endpoint, startMerkleIndex);
      // if `fetchTeiFromMerkleIndex returned undefined, either an error occurred or `startMerkleIndex` is in the future
      // the latter case is an edge case that's not worth the complexity to handle, so we'll just throw an error
      if (_from === undefined) {
        throw new Error("invalid start merkle index");
      }

      // hack to get typescript to recognize that `_from` can't be `undefined` at this point
      let from = _from;

      // function for throttling subgraph queries so that we don't bludgeon it to death:
      // - if we're caught up, sleep for 5 seconds, because we're basically waiting for another block
      // - if we're not caught up and `opts.throttleMs` was given sleep for `opts.throttleMs`
      // - otherwise, sleep for 0 milliseconds
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
        // then yield them in order
        if (insertions.length > 0) {
          from = maxArray(sorted.map((i) => i.totalEntityIndex)) + 1n;

          for (const { inner: insertion } of sorted) {
            // case on the kind of insertion event
            if ("numZeros" in insertion) {
              // if it's a `FilledBatchWithZerosEvent`, yield a batch of ZERO_VALUEs
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

              const batch = range(0, insertion.numZeros).map((i) => ({
                noteCommitment: TreeConstants.ZERO_VALUE,
                merkleIndex: startIndex + i,
              }));

              yield batch;
            } else if (NoteTrait.isEncryptedNote(insertion)) {
              // if it's an `EncryptedNote`, yield the note's commitment
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

              const res = {
                noteCommitment,
                merkleIndex: insertion.merkleIndex,
              };

              yield [res];
            } else {
              // otherwise, it's an `EncodedNote` - yield the note itself
              const meta = {
                merkleIndex: insertion.merkleIndex,
                note: insertion,
              };
              logger &&
                logger.debug("yielding note", {
                  insertionKind: "note",
                  meta,
                });

              yield [insertion as IncludedNote];
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
}
