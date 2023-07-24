import { maxArray, sleep, max } from "../../../utils";
import {
  EncryptedStateDiff,
  IterSyncOpts,
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

export class SubgraphSDKSyncAdapter implements SDKSyncAdapter {
  private readonly graphqlEndpoint: string;
  private readonly logger?: Logger;

  constructor(graphqlEndpoint: string, logger?: Logger) {
    this.graphqlEndpoint = graphqlEndpoint;
    this.logger = logger;
  }

  iterStateDiffs(
    startTotalEntityIndex: TotalEntityIndex,
    opts?: IterSyncOpts
  ): ClosableAsyncIterator<EncryptedStateDiff> {
    const endTotalEntityIndex = opts?.endTotalEntityIndex;
    const logger = this.logger;
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

        const latestIndexedBlock = await fetchLatestIndexedBlock(endpoint);
        await maybeApplyThrottle(latestIndexedBlock);

        // fetch notes and nfs on or after `from`, will return at most 100 of each
        const sdkEvents = await fetchSDKEvents(endpoint, from);

        // if we have notes and/or mullifiers, update from and get the last committed merkle index as of the entity index we saw
        if (sdkEvents.length > 0) {
          const highestTotalEntityIndex = maxArray(
            sdkEvents.map((n) => n.totalEntityIndex)
          );
          latestCommittedMerkleIndex = await fetchlatestCommittedMerkleIndex(
            endpoint
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

          const latestNewlySyncedMerkleIndex =
            latestMerkleIndexFromFiledBatches !== undefined &&
            latestMerkleIndexFromNotes !== undefined
              ? max(
                  latestMerkleIndexFromFiledBatches,
                  latestMerkleIndexFromNotes
                )
              : undefined;

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

          yield stateDiff;

          from = highestTotalEntityIndex + 1n;
        } else {
          // otherwise, we've caught up and there's nothing more to fetch.
          // set `from` to the entity index corresponding to the latest indexed block
          // if it's greater than the current `from`.

          // this is to prevent an busy loops in the case where the subgraph has indexed a block corresponding
          // to a totalEntityIndex > `endTotalEntityIndex` but we haven't found any insertions in that block
          const currentBlockTotalEntityIndex =
            TotalEntityIndexTrait.fromBlockNumber(latestIndexedBlock);
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
