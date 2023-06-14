import { pluck, maxArray, sleep, max } from "../../../utils";
import {
  EncryptedStateDiff,
  IterSyncOpts,
  SDKSyncAdapter,
} from "../../syncAdapter";
import { fetchLastCommittedMerkleIndex, fetchSDKEvents } from "./fetch";
import {
  TotalEntityIndex,
  TotalEntityIndexTrait,
  WithTotalEntityIndex,
} from "../../totalEntityIndex";
import { ClosableAsyncIterator } from "../../closableAsyncIterator";
import { fetchLatestIndexedBlock } from "../utils";
import {
  IncludedEncryptedNote,
  IncludedNote,
  Nullifier,
} from "../../../primitives";

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

      const applyThrottle = async (currentBlock: number) => {
        const isCaughtUp =
          from >=
          TotalEntityIndexTrait.fromComponents({
            blockNumber: BigInt(currentBlock),
          });
        const sleepDelay = max(opts?.throttleMs ?? 0, isCaughtUp ? 5000 : 0);
        await sleep(sleepDelay);
      };

      while (!closed && (!endTotalEntityIndex || from < endTotalEntityIndex)) {
        console.debug(
          `fetching state diffs from totalEntityIndex ${TotalEntityIndexTrait.toStringPadded(
            from
          )} (block ${
            TotalEntityIndexTrait.toComponents(from).blockNumber
          }) ...`
        );

        const currentBlock = await fetchLatestIndexedBlock(endpoint);
        await applyThrottle(currentBlock);

        // fetch notes and nfs on or after `from`, will return at most 100 of each
        const notesAndNullifiers = await fetchSDKEvents(endpoint, from);

        // if we have notes and/or mullifiers, update from and get the last committed merkle index as of the entity index we saw
        if (notesAndNullifiers.length > 0) {
          from = maxArray(pluck(notesAndNullifiers, "totalEntityIndex")) + 1n;
          lastCommittedMerkleIndex = await fetchLastCommittedMerkleIndex(
            endpoint
          );

          const notes = notesAndNullifiers.filter(
            ({ inner }) => typeof inner !== "bigint"
          ) as WithTotalEntityIndex<IncludedNote | IncludedEncryptedNote>[];
          const nullifiers = notesAndNullifiers.filter(
            ({ inner }) => typeof inner === "bigint"
          ) as WithTotalEntityIndex<Nullifier>[];

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
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }
}
