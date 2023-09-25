import { maxArray, sleep, max } from "../../../utils";
import {
  EncryptedStateDiff,
  SDKIterSyncOpts,
  SDKSyncAdapter,
} from "../../syncAdapter";
import { fetchlatestCommittedMerkleIndex, fetchSDKEvents } from "./fetch";
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
import { Logger } from "winston";
import { Histogram } from "../../../utils";
import { timedAsync } from "../../../utils/timing";

export class SubgraphSDKSyncAdapter implements SDKSyncAdapter {
  private readonly graphqlEndpoint: string;
  private readonly logger?: Logger;

  constructor(graphqlEndpoint: string, logger?: Logger) {
    this.graphqlEndpoint = graphqlEndpoint;
    this.logger = logger;
  }

  iterStateDiffs(
    startTotalEntityIndex: TotalEntityIndex,
    opts?: SDKIterSyncOpts
  ): ClosableAsyncIterator<EncryptedStateDiff> {
    const endTotalEntityIndex = opts?.endTotalEntityIndex;
    const logger = this.logger;

    const fetchHistogram = opts?.timing
      ? new Histogram("time to fetch SDK events for a diff (ms) per note")
      : undefined;
    let closed = false;

    const endpoint = this.graphqlEndpoint;
    const generator = async function* () {
      let from = startTotalEntityIndex;
      let latestCommittedMerkleIndex = await fetchlatestCommittedMerkleIndex(
        endpoint,
        from
      );

      const maybeApplyThrottle = async (currentBlock: number) => {
        const isCaughtUp =
          from >=
          TotalEntityIndexTrait.fromComponents({
            blockNumber: BigInt(currentBlock),
          });
        const sleepDelay = max(opts?.throttleMs ?? 0, isCaughtUp ? 5000 : 0);
        await sleep(sleepDelay);
      };

      while (!closed && (!endTotalEntityIndex || from < endTotalEntityIndex)) {
        const fromBlock = TotalEntityIndexTrait.toComponents(from).blockNumber;

        const rangeLogMsg = [
          `fetching state diffs from totalEntityIndex ${TotalEntityIndexTrait.toStringPadded(
            from
          )} (block ${fromBlock}) ...`,
          {
            startTotalEntityIndex: TotalEntityIndexTrait.toStringPadded(from),
            fromBlock: TotalEntityIndexTrait.toComponents(from).blockNumber,
          },
        ];
        if (logger) {
          logger.info(rangeLogMsg);
        } else {
          console.log(rangeLogMsg);
        }

        // fetch the latest indexed block minus `finalityBlocks`
        // if `latestIndexedBlock < 0`, then we simply wait and try again - this can occurr if the chain is brand new (e.g. in tests)
        const latestIndexedBlock =
          (await fetchLatestIndexedBlock(endpoint)) -
          (opts?.finalityBlocks ?? 0);
        if (latestIndexedBlock < 0) {
          await sleep(5000);
          continue;
        }

        await maybeApplyThrottle(latestIndexedBlock);

        const toTotalEntityIndex = TotalEntityIndexTrait.fromBlockNumber(
          latestIndexedBlock + 1,
          "UP_TO"
        );

        // fetch notes and nfs on or after `from`, will return at most 100 of each
        // if `numConfirmatinos` was set, we will only fetch data from blocks at least `finalityBlocks` blocks behind the tip
        const [sdkEvents, fetchTime] = await timedAsync(() =>
          fetchSDKEvents(endpoint, from, toTotalEntityIndex)
        );

        const newLatestCommittedMerkleIndex =
          await fetchlatestCommittedMerkleIndex(endpoint, toTotalEntityIndex);

        // if we have notes and/or mullifiers, update from and get the last committed merkle index as of the entity index we saw
        if (sdkEvents.length > 0) {
          latestCommittedMerkleIndex = newLatestCommittedMerkleIndex;
          const highestTotalEntityIndex = maxArray(
            sdkEvents.map((n) => n.totalEntityIndex)
          );

          const notes = sdkEvents.filter(
            ({ inner }) => typeof inner === "object"
          ) as WithTotalEntityIndex<IncludedNote | IncludedEncryptedNote>[];

          const nullifiers = sdkEvents.filter(
            ({ inner }) => typeof inner === "bigint"
          ) as WithTotalEntityIndex<Nullifier>[];

          const filledBatchEndIndices = sdkEvents
            .filter(({ inner }) => typeof inner === "number")
            .map(({ inner }) => inner as number);
          const latestMerkleIndexFromFiledBatches =
            filledBatchEndIndices.length > 0
              ? maxArray(filledBatchEndIndices)
              : undefined;

          const latestMerkleIndexFromNotes =
            notes.length > 0
              ? maxArray(Array.from(notes.map((n) => n.inner.merkleIndex)))
              : undefined;

          let latestNewlySyncedMerkleIndex: number | undefined;
          if (latestMerkleIndexFromFiledBatches === undefined) {
            latestNewlySyncedMerkleIndex = latestMerkleIndexFromNotes;
          } else if (latestMerkleIndexFromNotes === undefined) {
            latestNewlySyncedMerkleIndex = latestMerkleIndexFromFiledBatches;
          } else {
            // both are defined
            latestNewlySyncedMerkleIndex = max(
              latestMerkleIndexFromFiledBatches,
              latestMerkleIndexFromNotes
            );
          }

          const stateDiff: EncryptedStateDiff = {
            notes,
            nullifiers: nullifiers.map((n) => n.inner),
            latestNewlySyncedMerkleIndex,
            latestCommittedMerkleIndex,
            totalEntityIndex: highestTotalEntityIndex,
          };

          const yieldedLogMsg = ["yielding state diff", { stateDiff }];
          if (logger) {
            logger.info(yieldedLogMsg);
          } else {
            console.log(yieldedLogMsg);
          }

          fetchHistogram?.sample(fetchTime / stateDiff.notes.length);

          yield stateDiff;

          from = highestTotalEntityIndex + 1n;
        } else {
          // otherwise, there are no more new notes / tree insertions to fetch
          // however, there may have been a subtree update, so we check for that here
          const currentBlockTotalEntityIndex =
            TotalEntityIndexTrait.fromBlockNumber(latestIndexedBlock);

          // check the latest committed merkle index
          // if it's bigger than the one from the last iteration,
          // then emit an empty diff with only the latest committed merkle index
          if (
            !latestCommittedMerkleIndex ||
            (newLatestCommittedMerkleIndex &&
              newLatestCommittedMerkleIndex > latestCommittedMerkleIndex)
          ) {
            latestCommittedMerkleIndex = newLatestCommittedMerkleIndex;
            const stateDiff: EncryptedStateDiff = {
              notes: [],
              nullifiers: [],
              latestNewlySyncedMerkleIndex: undefined,
              latestCommittedMerkleIndex,
              totalEntityIndex: currentBlockTotalEntityIndex,
            };

            if (logger) {
              logger.info("yielding empty state diff with subtree update", {
                stateDiff,
              });
            } else {
              console.log("yielding empty state diff with subtree update", {
                stateDiff,
              });
            }
            yield stateDiff;
          }

          // set `from` to the entity index corresponding to the latest indexed block
          // if it's greater than the current `from`.
          // this is to prevent an busy loops in the case where the subgraph has indexed a block corresponding
          // to a totalEntityIndex > `endTotalEntityIndex` but we haven't found any insertions in that block
          if (currentBlockTotalEntityIndex > from) {
            from = currentBlockTotalEntityIndex;
          }
        }
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }

  async getLatestIndexedBlock(): Promise<number> {
    return await fetchLatestIndexedBlock(this.graphqlEndpoint);
  }
}
