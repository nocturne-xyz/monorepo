import { min } from "../../utils";
import { ClosableAsyncIterator } from "../closableAsyncIterator";
import {
  EncryptedStateDiff,
  IterStateDiffsOpts,
  SyncAdapter,
} from "../syncAdapter";
import {
  fetchLastCommittedMerkleIndex,
  fetchNotes,
  fetchNullifiers,
} from "./fetch";

const MAX_CHUNK_SIZE = 10000;

export class SubgraphSyncAdapter implements SyncAdapter {
  private readonly graphqlEndpoint: string;

  constructor(graphqlEndpoint: string) {
    this.graphqlEndpoint = graphqlEndpoint;
  }

  async iterStateDiffs(
    startBlock: number,
    opts?: IterStateDiffsOpts | undefined
  ): Promise<ClosableAsyncIterator<EncryptedStateDiff>> {
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

        const [notes, nullifiers, lastCommittedMerkleIndex] = await Promise.all(
          [
            fetchNotes(endpoint, from, to),
            fetchNullifiers(endpoint, from, to),
            fetchLastCommittedMerkleIndex(endpoint, to),
          ]
        );

        const nextMerkleIndex = lastCommittedMerkleIndex + 1;

        const stateDiff: EncryptedStateDiff = {
          notes,
          nullifiers,
          nextMerkleIndex,
          blockNumber: to,
        };

        console.log("yieding state diff:", stateDiff);

        yield stateDiff;

        from = to;
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }
}
