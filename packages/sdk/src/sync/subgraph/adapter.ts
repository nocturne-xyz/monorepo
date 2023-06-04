import { min, sleep } from "../../utils";
import { ClosableAsyncIterator } from "../closableAsyncIterator";
import {
  EncryptedStateDiff,
  IterSyncOpts,
  SDKSyncAdapter,
} from "../syncAdapter";
import {
  fetchLastCommittedMerkleIndex,
  fetchNotes,
  fetchNullifiers,
} from "./fetch";
import { fetchLatestIndexedBlock } from "./utils";

const MAX_CHUNK_SIZE = 10000;

export class SubgraphSDKSyncAdapter implements SDKSyncAdapter {
  private readonly graphqlEndpoint: string;

  constructor(graphqlEndpoint: string) {
    this.graphqlEndpoint = graphqlEndpoint;
  }

  iterStateDiffs(
    startBlock: number,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<EncryptedStateDiff> {
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
        console.log(`from: ${from}`);
        console.log(`to: ${to}`);
        console.log(`endBlock: ${endBlock}`);

        // Only fetch up to end block
        if (endBlock) {
          to = min(to, endBlock);
        }

        // Only fetch up to the latest indexed block
        const latestIndexedBlock = await fetchLatestIndexedBlock(endpoint);
        console.log(`latestIndexedBlock: ${latestIndexedBlock}`);
        to = min(to, latestIndexedBlock);

        // Exceeded tip, sleep
        if (from > latestIndexedBlock) {
          await sleep(5_000);
          continue;
        }

        console.log(`fetching state diff from ${from} to ${to}...`);

        const [notes, nullifiers, lastCommittedMerkleIndex] = await Promise.all(
          [
            fetchNotes(endpoint, from, to),
            fetchNullifiers(endpoint, from, to),
            fetchLastCommittedMerkleIndex(endpoint, to),
          ]
        );

        const stateDiff: EncryptedStateDiff = {
          notes,
          nullifiers,
          lastCommittedMerkleIndex,
          blockNumber: to,
        };

        console.log("yielding state diff:", stateDiff);

        yield stateDiff;

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
