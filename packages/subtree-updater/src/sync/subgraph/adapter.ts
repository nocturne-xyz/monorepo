import {
  ClosableAsyncIterator,
  SubgraphUtils,
  IterSyncOpts,
  min,
  sleep,
  fetchNotes,
  IncludedNote,
  IncludedNoteCommitment,
  NoteTrait,
  IncludedEncryptedNote,
} from "@nocturne-xyz/sdk";
import { SubtreeUpdaterSyncAdapter } from "../syncAdapter";

const { fetchLatestIndexedBlock } = SubgraphUtils;

const MAX_CHUNK_SIZE = 10000;

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
  ): ClosableAsyncIterator<IncludedNote | IncludedNoteCommitment> {
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

        console.log(`fetching notes from ${from} to ${to}...`);
        const notes: (IncludedNote | IncludedEncryptedNote)[] =
          await fetchNotes(endpoint, from, to);

        const noteOrCommitments: (IncludedNote | IncludedNoteCommitment)[] =
          notes.map((note) => {
            if (NoteTrait.isEncryptedNote(note)) {
              return {
                noteCommitment: (note as IncludedEncryptedNote).commitment,
                merkleIndex: (note as IncludedEncryptedNote).merkleIndex,
              };
            } else {
              return note as IncludedNote;
            }
          });

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
