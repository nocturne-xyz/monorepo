import {
  ClosableAsyncIterator,
  IncludedEncryptedNote,
  IncludedNote,
  Nullifier,
  SDKSyncAdapter,
  TotalEntityIndex,
  TotalEntityIndexTrait,
  WithTotalEntityIndex,
  maxArray,
  sleep,
  maxNullish,
  SubgraphUtils,
} from "@nocturne-xyz/core";
import { EncryptedStateDiff, SDKIterSyncOpts } from "@nocturne-xyz/core";
import { Client as UrqlClient, fetchExchange } from "@urql/core";
import {
  HasuraSupportedNetwork,
  FetchLatestIndexedMerkleIndexFn,
  makeFetchLatestIndexedMerkleIndex,
  makeFetchSdkEventsAndLatestCommittedMerkleIndex,
  FetchSdkEventsAndLatestCommitedMerkleIndexFn,
  HasuraSupportedNetworks,
} from "./fetch";

export { HasuraSupportedNetwork } from "./fetch";

const { fetchLatestIndexedBlock } = SubgraphUtils;

export class HasuraSdkSyncAdapter implements SDKSyncAdapter {
  client: UrqlClient;
  subgraphUrl: string;
  network: HasuraSupportedNetwork;

  fetchLatestIndexedMerkleIndex: FetchLatestIndexedMerkleIndexFn;
  fetchSdkEventsAndLatestCommittedMerkleIndex: FetchSdkEventsAndLatestCommitedMerkleIndexFn;

  constructor(graphqlEndpoint: string, subgraphUrl: string, network: string) {
    this.subgraphUrl = subgraphUrl;

    if (!HasuraSupportedNetworks.includes(network)) {
      throw new Error(
        `hasura-sync-adapters doesn't support network: ${network}`
      );
    }

    this.network = network as HasuraSupportedNetwork;

    this.client = new UrqlClient({
      url: graphqlEndpoint,
      exchanges: [fetchExchange],
    });

    this.fetchLatestIndexedMerkleIndex = makeFetchLatestIndexedMerkleIndex(
      this.client,
      network as HasuraSupportedNetwork
    );
    this.fetchSdkEventsAndLatestCommittedMerkleIndex =
      makeFetchSdkEventsAndLatestCommittedMerkleIndex(
        this.client,
        this.network
      );
  }

  iterStateDiffs(
    startTotalEntityIndex: TotalEntityIndex,
    opts?: SDKIterSyncOpts
  ): ClosableAsyncIterator<EncryptedStateDiff> {
    const endTotalEntityIndex = opts?.endTotalEntityIndex;

    const fetchSdkEventsAndLatestCommittedMerkleIndex =
      this.fetchSdkEventsAndLatestCommittedMerkleIndex;
    const fetchLatestIndexedBlock = async () =>
      await this.getLatestIndexedBlock();

    let closed = false;
    const generator = async function* () {
      let from = startTotalEntityIndex;
      let latestCommittedMerkleIndex = undefined;
      while (!closed && (!endTotalEntityIndex || from < endTotalEntityIndex)) {
        const toBlock =
          (await fetchLatestIndexedBlock()) - (opts?.finalityBlocks ?? 0);

        if (TotalEntityIndexTrait.toComponents(from).blockNumber >= toBlock) {
          await sleep(5000);
          continue;
        }

        const {
          events,
          latestCommittedMerkleIndex: newLatestCommittedMerkleIndex,
        } = await fetchSdkEventsAndLatestCommittedMerkleIndex(
          from,
          toBlock + 1
        );

        // if there are sdk events, produce the requisite diff.
        // otherwise, see if latestCommittedMerkleIndex changed - if so, yield an empty state diff with the new merkle index
        if (events.length > 0) {
          latestCommittedMerkleIndex = newLatestCommittedMerkleIndex;
          const highestTotalEntityIndex = maxArray(
            events.map((e) => e.totalEntityIndex)
          );

          const notes = events.filter(
            ({ inner }) => typeof inner === "object"
          ) as WithTotalEntityIndex<IncludedNote | IncludedEncryptedNote>[];

          const nullifiers = events.filter(
            ({ inner }) => typeof inner === "bigint"
          ) as WithTotalEntityIndex<Nullifier>[];

          const filledBatchEndIndices = events
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
            totalEntityIndex: highestTotalEntityIndex,
          };

          console.log("yielding state diff", { stateDiff });

          yield stateDiff;

          from = highestTotalEntityIndex + 1n;
        } else {
          // otherwise, there are no more new notes / tree insertions to fetch
          // however, there may have been a subtree update, which we need to notify the sdk of
          // so we check for that here
          const toBlockTEI = TotalEntityIndexTrait.fromBlockNumber(
            toBlock,
            "THROUGH"
          );

          // check the latest committed merkle index
          // if it's bigger than the one from the last iteration,
          // then emit an empty diff with only the latest committed merkle index
          if (
            latestCommittedMerkleIndex &&
            newLatestCommittedMerkleIndex &&
            newLatestCommittedMerkleIndex > latestCommittedMerkleIndex
          ) {
            latestCommittedMerkleIndex = newLatestCommittedMerkleIndex;

            const stateDiff: EncryptedStateDiff = {
              notes: [],
              nullifiers: [],
              latestNewlySyncedMerkleIndex: undefined,
              latestCommittedMerkleIndex,
              totalEntityIndex: toBlockTEI,
            };

            console.log("yielding empty state diff with subtree update", {
              stateDiff,
            });

            yield stateDiff;
          }

          if (toBlockTEI > from) {
            from = toBlockTEI;
          }
        }

        await sleep(opts?.throttleMs ?? 0);
      }
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }

  async getLatestIndexedBlock(): Promise<number> {
    return await fetchLatestIndexedBlock(this.subgraphUrl);
  }

  async getLatestIndexedMerkleIndex(
    toBlock?: number
  ): Promise<number | undefined> {
    return await this.fetchLatestIndexedMerkleIndex(toBlock);
  }
}
