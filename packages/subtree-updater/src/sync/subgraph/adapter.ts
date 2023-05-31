import {
  ClosableAsyncIterator,
  SubgraphUtils,
  IterSyncOpts,
  min,
  sleep,
  Note,
  fetchNotes,
  IncludedNote,
  IncludedEncryptedNote,
  NoteTrait,
  TreeConstants,
} from "@nocturne-xyz/sdk";
import { SubtreeUpdaterSyncAdapter } from "../syncAdapter";
import {
  fetchFilledBatchWithZerosEvents,
  fetchLatestSubtreeIndex,
} from "./fetch";
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

        console.log(`fetching insertions from ${from} to ${to}...`);

        const [notesWithTimestamps, filledBatchWithZerosEvents] =
          await Promise.all([
            fetchNotes(endpoint, from, to),
            fetchFilledBatchWithZerosEvents(endpoint, from, to),
          ]);
        const notes = notesWithTimestamps.map(({ inner }) => inner);

        const combined = [...notes, ...filledBatchWithZerosEvents].sort(
          (a, b) => a.merkleIndex - b.merkleIndex
        );

        console.log("yielding sorted insertions:", combined);

        for (const insertion of combined) {
          if ("numZeros" in insertion) {
            for (let i = 0; i < insertion.numZeros; i++) {
              yield TreeConstants.ZERO_VALUE;
            }
          } else if (NoteTrait.isEncryptedNote(insertion)) {
            yield (insertion as IncludedEncryptedNote).commitment;
          } else {
            yield insertion as IncludedNote;
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
    return fetchLatestSubtreeIndex(this.graphqlEndpoint);
  }
}
