import {
  ClosableAsyncIterator,
  fetchLatestIndexedBlock,
  min,
  sleep,
} from "@nocturne-xyz/sdk";
import { DepositEvent, DepositEventType } from "../../types";
import { IterSyncOpts, ScreenerSyncAdapter } from "../syncAdapter";
import { fetchDepositEvents } from "./fetch";

const MAX_CHUNK_SIZE = 10000;

export class SubgraphScreenerSyncAdapter implements ScreenerSyncAdapter {
  private readonly graphqlEndpoint: string;

  constructor(graphqlEndpoint: string) {
    this.graphqlEndpoint = graphqlEndpoint;
  }

  async iterDepositEvents(
    type: DepositEventType,
    startBlock: number,
    opts?: IterSyncOpts
  ): Promise<ClosableAsyncIterator<DepositEvent[]>> {
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
        if (endBlock) {
          to = min(to, endBlock);
        }

        // only fetch up to the latest indexed block
        const latestIndexedBlock = await fetchLatestIndexedBlock(endpoint);
        to = min(to, latestIndexedBlock);

        if (from >= to) {
          await sleep(5_000);
          continue;
        }

        const depositEvents = await fetchDepositEvents(
          endpoint,
          type,
          from,
          to
        );
        console.log("yieding deposit events:", depositEvents);

        yield depositEvents;

        from = to + 1;
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }
}
