import {
  ClosableAsyncIterator,
  IterSyncOpts,
  sleep,
  fetchDepositEvents,
  DepositEventType,
  TotalEntityIndex,
  maxArray,
  pluck,
} from "@nocturne-xyz/sdk";

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
      while (!closed && (!endTotalEntityIndex || from < endTotalEntityIndex)) {
        console.log(
          `fetching deposit events from total entity index ${from}...`
        );

        // fetch deposit events with total entity index on or after `from`, will return at most 100
        const depositEventsWithTotalEntityIndices = await fetchDepositEvents(
          endpoint,
          {
            type,
            fromTotalEntityIndex: from,
          }
        );

        // if we have deposit events, get the greatest total entity index we saw and set from to that plus one
        if (depositEventsWithTotalEntityIndices.length > 0) {
          from = maxArray(
            pluck(depositEventsWithTotalEntityIndices, "totalEntityIndex")
          );
        } else {
          // otherwise, sleep for a bit and try again - in this case we're caught up to the chain
          await sleep(5_000);
          continue;
        }

        const depositEvents = pluck(
          depositEventsWithTotalEntityIndices,
          "inner"
        );
        console.log("yielding deposit events:", depositEvents);

        yield {
          totalEntityIndex: from,
          depositEvents,
        };

        // prevent fetching same events again
        from += 1n;
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }
}
