import {
  EncryptedStateDiff,
  SDKIterSyncOpts,
  SDKSyncAdapter,
  maxArray,
  sleep,
  max,
  maxNullish,
  SubgraphUtils,
  TotalEntityIndex,
  TotalEntityIndexTrait,
  WithTotalEntityIndex,
  ClosableAsyncIterator,
  IncludedEncryptedNote,
  IncludedNote,
  Nullifier,
  Histogram,
  timedAsync,
} from "@nocturne-xyz/core";
import { fetchSDKEvents } from "./fetch";
import { Logger } from "winston";

const {
  fetchLatestSubtreeCommit,
  fetchLatestIndexedBlock,
  fetchLatestCommittedMerkleIndex,
} = SubgraphUtils;

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
      const latestCommit = await fetchLatestSubtreeCommit(
        endpoint,
        from,
        logger
      );
      let latestCommittedMerkleIndex = latestCommit?.merkleIndex;
      let latestCommitTei = latestCommit?.tei;

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
          fetchSDKEvents(endpoint, from, toTotalEntityIndex, logger)
        );

        const newLatestCommit = await fetchLatestSubtreeCommit(
          endpoint,
          toTotalEntityIndex,
          logger
        );
        const newLatestCommittedMerkleIndex = newLatestCommit?.merkleIndex;
        const newLatestCommitTei = newLatestCommit?.tei;

        // if we have notes and/or mullifiers, update from and set the last committed merkle index as of the entity index we saw
        if (sdkEvents.length > 0) {
          latestCommittedMerkleIndex = newLatestCommittedMerkleIndex;
          latestCommitTei = newLatestCommitTei;

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
          const latestMerkleIndexFromFilledBatches =
            filledBatchEndIndices.length > 0
              ? maxArray(filledBatchEndIndices)
              : undefined;

          const latestMerkleIndexFromNotes =
            notes.length > 0
              ? maxArray(Array.from(notes.map((n) => n.inner.merkleIndex)))
              : undefined;

          const latestNewlySyncedMerkleIndex = maxNullish(
            latestMerkleIndexFromFilledBatches,
            latestMerkleIndexFromNotes
          );

          const stateDiff: EncryptedStateDiff = {
            notes,
            nullifiers: nullifiers.map((n) => n.inner),
            latestNewlySyncedMerkleIndex,
            latestCommittedMerkleIndex,
            latestCommitTei,
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
          // however, there may have been a subtree update, which we need to notify the sdk of
          // so we check for that here
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
            latestCommitTei = newLatestCommitTei;
            const stateDiff: EncryptedStateDiff = {
              notes: [],
              nullifiers: [],
              latestNewlySyncedMerkleIndex: undefined,
              latestCommittedMerkleIndex,
              latestCommitTei,
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

  async getLatestIndexedMerkleIndex(
    toBlock?: number
  ): Promise<number | undefined> {
    return await fetchLatestCommittedMerkleIndex(
      this.graphqlEndpoint,
      toBlock
        ? TotalEntityIndexTrait.fromBlockNumber(toBlock, "THROUGH")
        : undefined,
      this.logger
    );
  }
}
