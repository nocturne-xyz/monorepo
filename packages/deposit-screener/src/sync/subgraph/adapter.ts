import {
  ClosableAsyncIterator,
  SubgraphUtils,
  IterSyncOpts,
  min,
  sleep,
  fetchDepositEvents,
  DepositEventType,
} from "@nocturne-xyz/sdk";

import { DepositEventsBatch, ScreenerSyncAdapter } from "../syncAdapter";

const { fetchLatestIndexedBlock } = SubgraphUtils;

const MAX_CHUNK_SIZE = 10000;

export class SubgraphScreenerSyncAdapter implements ScreenerSyncAdapter {
  private readonly graphqlEndpoint: string;

  constructor(graphqlEndpoint: string) {
    this.graphqlEndpoint = graphqlEndpoint;
  }

  iterDepositEvents(
    type: DepositEventType,
    startBlock: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<DepositEventsBatch> {
    const chunkSize = opts?.maxChunkSize
      ? min(opts.maxChunkSize, MAX_CHUNK_SIZE)
      : MAX_CHUNK_SIZE;

    const endBlock = opts?.endBlock;
    let closed = false;

    const endpoint = this.graphqlEndpoint;
    const generator = async function* () {
      let from = startBlock;
      while (!closed && (!endBlock || from < endBlock)) {
        let to = from + chunkSize;

        // Only fetch up to end block
        if (endBlock) {
          to = min(to, endBlock);
        }

        // Only fetch up to the latest indexed block
        const latestIndexedBlock = await fetchLatestIndexedBlock(endpoint);
        to = min(to, latestIndexedBlock);

        // Exceeded tip, sleep
        if (latestIndexedBlock <= from) {
          await sleep(5_000);
          continue;
        }

        console.log(`fetching deposit events from ${from} to ${to}...`);
        const depositEvents = await fetchDepositEvents(
          endpoint,
          type,
          from,
          to
        );
        console.log("yielding deposit events:", depositEvents);

        yield {
          blockNumber: to,
          depositEvents,
        };

        from = to + 1;

        if (opts?.throttleMs && latestIndexedBlock - from > chunkSize) {
          await sleep(opts.throttleMs);
        }
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }
}
