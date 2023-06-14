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
import {
  TotalEntityIndex,
  TotalEntityIndexTrait,
} from "../../totalEntityIndex";
import { ClosableAsyncIterator } from "../../closableAsyncIterator";
import { fetchLatestIndexedBlock } from "../utils";

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
      const loopCond = () =>
        !closed && (!endTotalEntityIndex || from < endTotalEntityIndex);
      while (loopCond()) {
        console.debug(
          `fetching state diffs from totalEntityIndex ${TotalEntityIndexTrait.toStringPadded(
            from
          )} (block ${
            TotalEntityIndexTrait.toComponents(from).blockNumber
          }) ...`
        );
        const currentBlock = await fetchLatestIndexedBlock(endpoint);
        // if we're caught up, wait for a bit and try again
        if (
          from >
          TotalEntityIndexTrait.fromComponents({
            blockNumber: BigInt(currentBlock),
          })
        ) {
          await sleep(5000);
          continue;
        }

        // fetch notes and nfs on or after `from`, will return at most 100 of each
        const [notes, nullifiers] = await Promise.all([
          fetchNotes(endpoint, from),
          fetchNullifiers(endpoint, from),
        ]);

        // if we have notes and/or mullifiers, update from and get the last committed merkle index as of the entity index we saw
        if (notes.length + nullifiers.length > 0) {
          from =
            maxArray(pluck([...notes, ...nullifiers], "totalEntityIndex")) + 1n;
          lastCommittedMerkleIndex = await fetchLastCommittedMerkleIndex(
            endpoint
          );

          const stateDiff: EncryptedStateDiff = {
            notes,
            nullifiers: pluck(nullifiers, "inner"),
            lastCommittedMerkleIndex,
            totalEntityIndex: from - 1n,
          };

          console.debug("yielding state diff:", stateDiff);

          yield stateDiff;
        } else {
          // otherwise, we've caught up and there's nothing more to fetch.
          // set `from` to the entity index corresponding to the latest indexed block and continue to avoid emitting empty diff
          from =
            TotalEntityIndexTrait.fromComponents({
              blockNumber: BigInt(currentBlock),
            }) + 1n;
        }

        // if we're gonna do another iteration, apply throttle
        if (opts?.throttleMs && loopCond()) {
          await sleep(opts.throttleMs);
        }
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }
}
