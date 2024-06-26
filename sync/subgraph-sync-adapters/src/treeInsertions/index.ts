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
  TreeInsertionSyncAdapter,
  TreeInsertionSyncOpts,
  SubgraphUtils,
} from "@nocturne-xyz/core";
import { fetchTreeInsertions, fetchTeiFromMerkleIndex } from "./fetch";
import { Logger } from "winston";
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
          : await fetchTeiFromMerkleIndex(endpoint, startMerkleIndex, logger);
      // if `fetchTeiFromMerkleIndex returned undefined, either an error occurred or `startMerkleIndex` is in the future
      // the latter case is an edge case that's not worth the complexity to handle, so we'll just throw an error
      if (_from === undefined) {
        throw new Error(`invalid start merkle index ${_from}`);
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

        // if `finalityBlocks` is set and is non-zero, only fetch insertions from blocks at least `finalityBlocks` behind the tip
        const toBlock =
          (await fetchLatestIndexedBlock(endpoint)) -
          (opts?.finalityBlocks ?? 0);
        if (toBlock < 0) {
          await sleep(opts?.throttleOnEmptyMs ?? 0);
          continue;
        }
        // fetch insertions from the subgraph, but filter out any that are from blocks that haven't been indexed yet
        const insertions = await fetchTreeInsertions(
          endpoint,
          from,
          TotalEntityIndexTrait.fromBlockNumber(toBlock + 1, "UP_TO"),
          logger
        );

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

              // filter out any insertions whose merkle indices < `startMerkleIndex`
              // this can occurr if this is the first iteration of the generator loop
              // and `startMerkleIndex` did not correspond exactly to an entity, which
              // can only occur if `startmerkleIndex` falls somewhere in the middle of a batch of zeros
              yield batch.filter(
                ({ merkleIndex }) => merkleIndex >= startMerkleIndex
              );
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
