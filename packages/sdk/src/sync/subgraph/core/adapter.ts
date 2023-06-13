import { pluck, maxArray, sleep } from "../../../utils";
import {
  EncryptedStateDiff,
  IterSyncOpts,
  SDKSyncAdapter,
} from "../../syncAdapter";
import {
  fetchLastCommittedMerkleIndex,
  fetchNotes,
  fetchNullifiers,
} from "./fetch";
import { TotalEntityIndex } from "../../totalEntityIndex";
import { ClosableAsyncIterator } from "../../closableAsyncIterator";

export class SubgraphSDKSyncAdapter implements SDKSyncAdapter {
  private readonly graphqlEndpoint: string;

  constructor(graphqlEndpoint: string) {
    this.graphqlEndpoint = graphqlEndpoint;
  }

  iterStateDiffs(
    startTotalEntityIndex: TotalEntityIndex,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<EncryptedStateDiff> {
    const endTotalEntityIndex = opts?.endTotalEntityIndex;
    let closed = false;

    const endpoint = this.graphqlEndpoint;
    const generator = async function* () {
      let from = startTotalEntityIndex;
      let lastCommittedMerkleIndex = await fetchLastCommittedMerkleIndex(
        endpoint,
        from
      );
      while (!closed && (!endTotalEntityIndex || from < endTotalEntityIndex)) {
        console.log(`fetching state diff from total entity index ${from}...`);

        // fetch notes and nfs on or after `from`, will return at most 100 of each
        const [notes, nullifiers] = await Promise.all([
          fetchNotes(endpoint, from),
          fetchNullifiers(endpoint, from),
        ]);

        // if we have notes and/or mullifiers, update from and get the last committed merkle index as of the entity index we saw
        if (notes.length + nullifiers.length > 0) {
          from = maxArray(pluck([...notes, ...nullifiers], "totalEntityIndex"));
          lastCommittedMerkleIndex = await fetchLastCommittedMerkleIndex(
            endpoint,
            from
          );
        } else {
          // otherwise, sleep for a bit and try again
          await sleep(5_000);
          continue;
        }

        const stateDiff: EncryptedStateDiff = {
          notes,
          nullifiers: pluck(nullifiers, "inner"),
          lastCommittedMerkleIndex,
          totalEntityIndex: from,
        };

        console.log("yielding state diff:", stateDiff);

        yield stateDiff;

        // prevent fetching same events again
        from += 1n;
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }
}
