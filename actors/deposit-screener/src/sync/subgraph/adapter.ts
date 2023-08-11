import {
  ClosableAsyncIterator,
  IterSyncOpts,
  sleep,
  fetchDepositEvents,
  DepositEventType,
  TotalEntityIndex,
  maxArray,
  TotalEntityIndexTrait,
  SubgraphUtils,
  max,
} from "@nocturne-xyz/sdk";
import { Logger } from "winston";

const { fetchLatestIndexedBlock } = SubgraphUtils;

import { DepositEventsBatch, ScreenerSyncAdapter } from "../syncAdapter";

export class SubgraphScreenerSyncAdapter implements ScreenerSyncAdapter {
  private readonly graphqlEndpoint: string;
  private readonly logger?: Logger;

  constructor(graphqlEndpoint: string, logger?: Logger) {
    this.graphqlEndpoint = graphqlEndpoint;
    this.logger = logger;
  }

  iterDepositEvents(
    type: DepositEventType,
    startTotalEntityIndex: TotalEntityIndex,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<DepositEventsBatch> {
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
          logger.info("fetching deposit events", {
            from,
            fromBlock: TotalEntityIndexTrait.toComponents(from).blockNumber,
          });

        const latestIndexedBlock = await fetchLatestIndexedBlock(endpoint);
        await maybeApplyThrottle(latestIndexedBlock);

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
          const highestTotalEntityIndex = maxArray(
            depositEventsWithTotalEntityIndices.map((e) => e.totalEntityIndex)
          );
          const depositEvents = depositEventsWithTotalEntityIndices.map(
            (e) => e.inner
          );

          logger && logger.debug("yielding deposit events", depositEvents);

          yield {
            totalEntityIndex: highestTotalEntityIndex,
            depositEvents,
          };

          from = highestTotalEntityIndex + 1n;
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
