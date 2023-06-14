import {
  ClosableAsyncIterator,
  IterSyncOpts,
  sleep,
  fetchDepositEvents,
  DepositEventType,
  TotalEntityIndex,
  maxArray,
  pluck,
  TotalEntityIndexTrait,
  SubgraphUtils,
} from "@nocturne-xyz/sdk";

const { fetchLatestIndexedBlock } = SubgraphUtils;

import { DepositEventsBatch, ScreenerSyncAdapter } from "../syncAdapter";

export class SubgraphScreenerSyncAdapter implements ScreenerSyncAdapter {
  private readonly graphqlEndpoint: string;

  constructor(graphqlEndpoint: string) {
    this.graphqlEndpoint = graphqlEndpoint;
  }

  iterDepositEvents(
    type: DepositEventType,
    startTotalEntityIndex: TotalEntityIndex,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<DepositEventsBatch> {
    const endpoint = this.graphqlEndpoint;
    const endTotalEntityIndex = opts?.endTotalEntityIndex;

    let closed = false;
    const generator = async function* () {
      let from = startTotalEntityIndex;
      const loopCond = () =>
        !closed && (!endTotalEntityIndex || from < endTotalEntityIndex);
      while (loopCond()) {
        console.debug(
          `fetching deposit events from totalEntityIndex ${TotalEntityIndexTrait.toStringPadded(
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

        // fetch deposit events with total entity index on or after `from`, will return at most 100
        const depositEventsWithTotalEntityIndices = await fetchDepositEvents(
          endpoint,
          {
            type,
            fromTotalEntityIndex: from,
          }
        );

        // if we have deposit events, get the greatest total entity index we saw and set from to that, and add one after we yield
        if (depositEventsWithTotalEntityIndices.length > 0) {
          from =
            maxArray(
              pluck(depositEventsWithTotalEntityIndices, "totalEntityIndex")
            ) + 1n;

          const depositEvents = pluck(
            depositEventsWithTotalEntityIndices,
            "inner"
          );
          console.debug("yielding deposit events:", depositEvents);

          yield {
            totalEntityIndex: from - 1n,
            depositEvents,
          };
        } else {
          // otherwise, we've caught up and there's nothing more to fetch.
          // set `from` to the entity index corresponding to the latest indexed block and try again
          from =
            TotalEntityIndexTrait.fromComponents({
              blockNumber: BigInt(currentBlock),
            }) + 1n;
        }

        // if we're gonna do another iteration, apply throttle
        if (opts?.throttleMs && loopCond()) {
          await sleep(opts.throttleMs);
        }
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }
}
