import {
  ClosableAsyncIterator,
  SubgraphUtils,
  IterSyncOpts,
  min,
  sleep,
  IncludedNote,
  IncludedNoteCommitment,
} from "@nocturne-xyz/sdk";
import { SubtreeUpdaterSyncAdapter } from "../syncAdapter";
import { fetchNotesOrCommitments } from "./fetch";

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
    startMerkleIndex: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<IncludedNote | IncludedNoteCommitment> {
    const chunkSize = opts?.maxChunkSize
      ? min(opts.maxChunkSize, MAX_CHUNK_SIZE)
      : MAX_CHUNK_SIZE;

    let closed = false;

    const endpoint = this.graphqlEndpoint;
    const generator = async function* () {
      let from = startMerkleIndex;
      while (!closed) {
        let to = from + chunkSize;

        // Only fetch up to the latest indexed block
        const latestIndexedBlock = await fetchLatestIndexedBlock(endpoint);

        console.log(`fetching notes from merkle index ${from} to ${to}...`);
        const noteOrCommitments: (IncludedNote | IncludedNoteCommitment)[] =
          await fetchNotesOrCommitments(endpoint, from, to, latestIndexedBlock);

        // if none were returned, then we've reached the end of the tree
        // sleep and wait for more insertions
        if (noteOrCommitments.length === 0) {
          await sleep(5_000);
          continue;
        }

        for (const noteOrCommitment of noteOrCommitments) {
          yield noteOrCommitment;
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
}
