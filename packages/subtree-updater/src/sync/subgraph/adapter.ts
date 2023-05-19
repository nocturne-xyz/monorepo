import {
  ClosableAsyncIterator,
  SubgraphUtils,
  IterSyncOpts,
  min,
  sleep,
  Note,
} from "@nocturne-xyz/sdk";
import { SubtreeUpdaterSyncAdapter } from "../syncAdapter";
import { fetchInsertions, fetchLatestCommittedSubtreeIndex } from "./fetch";

const { fetchLatestIndexedBlock } = SubgraphUtils;

const MAX_CHUNK_SIZE = 100_000;

export class SubgraphSubtreeUpdaterSyncAdapter
  implements SubtreeUpdaterSyncAdapter
{
  private readonly graphqlEndpoint: string;

  constructor(graphqlEndpoint: string) {
    this.graphqlEndpoint = graphqlEndpoint;
  }

  iterInsertions(
    startBlock: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<Note | bigint> {
    const chunkSize = opts?.maxChunkSize
      ? min(opts.maxChunkSize, MAX_CHUNK_SIZE)
      : MAX_CHUNK_SIZE;

    let closed = false;

    const endpoint = this.graphqlEndpoint;
    const generator = async function* () {
      let from = startBlock;
      while (!closed) {
        let to = from + chunkSize;

        // Only fetch up to the latest indexed block
        const latestIndexedBlock = await fetchLatestIndexedBlock(endpoint);
        to = min(to, latestIndexedBlock);

        // Exceeded tip, sleep
        if (from > latestIndexedBlock) {
          await sleep(1_000);
          continue;
        }

        const insertions: (Note | bigint[])[] = await fetchInsertions(
          endpoint,
          from,
          to
        );

        for (const insertion of insertions) {
          if (Array.isArray(insertion)) {
            for (const nc of insertion) {
              yield nc;
            }
          } else {
            yield insertion;
          }
        }

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

  async fetchLatestSubtreeIndex(): Promise<number> {
    const latestIndexedBlock = await fetchLatestCommittedSubtreeIndex(
      this.graphqlEndpoint
    );
    return latestIndexedBlock;
  }
}
