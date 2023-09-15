import {
  ClosableAsyncIterator,
  sleep,
  IncludedNote,
  IncludedEncryptedNote,
  NoteTrait,
  TreeConstants,
  maxArray,
  TotalEntityIndexTrait,
  range,
} from "@nocturne-xyz/core";
import {
  TreeInsertionSyncAdapter,
  TreeInsertionSyncOpts,
} from "../syncAdapter";
import { fetchTreeInsertions, fetchTeiFromMerkleIndex } from "./fetch";
import { Logger } from "winston";
import { Insertion } from "@nocturne-xyz/persistent-log";

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
    opts?: TreeInsertionSyncOpts
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

      while (!closed && (!endTotalEntityIndex || from < endTotalEntityIndex)) {
        logger &&
          logger.info("fetching insertions", {
            from,
            fromBlock: TotalEntityIndexTrait.toComponents(from).blockNumber,
          });

        await sleep(opts?.throttleMs ?? 0);
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
          // sleep a bit longer and try again to avoid hammering the subgraph
          await sleep(opts?.throttleOnEmptyMs ?? 0);
        }
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }
}
