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
  max,
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

      const applyThrottle = async (currentBlock: number) => {
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
          `fetching deposit events from totalEntityIndex ${TotalEntityIndexTrait.toStringPadded(
            from
          )} (block ${
            TotalEntityIndexTrait.toComponents(from).blockNumber
          }) ...`
        );

        const currentBlock = await fetchLatestIndexedBlock(endpoint);
        await applyThrottle(currentBlock);

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
          console.log("yielding deposit events:", depositEvents);

          yield {
            totalEntityIndex: from - 1n,
            depositEvents,
          };
        } else {
          // otherwise, we've caught up and there's nothing more to fetch.
          // set `from` to the entity index corresponding to the latest indexed block and try again
          from = TotalEntityIndexTrait.fromComponents({
            blockNumber: BigInt(currentBlock),
          });
        }
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }
}
