import { ClosableAsyncIterator, IncludedEncryptedNote, IncludedNote, Nullifier, SDKSyncAdapter, TotalEntityIndex, TotalEntityIndexTrait, WithTotalEntityIndex, max, maxArray, sleep } from "@nocturne-xyz/core";
import { EncryptedStateDiff, SDKIterSyncOpts } from "@nocturne-xyz/core/dist/src/sync/syncAdapter";
import { Client as UrqlClient, fetchExchange } from "@urql/core";
import { fetchLatestIndexedBlock, fetchSdkEventsAndLatestCommittedMerkleIndex } from "./fetch";

export class HasuraSdkSyncAdapter implements SDKSyncAdapter {
  client: UrqlClient;

  constructor(graphqlEndpoint: string) {
    this.client = new UrqlClient({
      url: graphqlEndpoint,
      exchanges: [fetchExchange],
    });
  }

  iterStateDiffs(
    startTotalEntityIndex: TotalEntityIndex,
    opts?: SDKIterSyncOpts
  ): ClosableAsyncIterator<EncryptedStateDiff> {
    const endTotalEntityIndex = opts?.endTotalEntityIndex;

    const client = this.client;
    let closed = false;
    const generator = async function* () {
      let from = startTotalEntityIndex;
      let latestCommittedMerkleIndex = undefined;;
      while (!closed && (!endTotalEntityIndex || from < endTotalEntityIndex)) {
        const toBlock = await fetchLatestIndexedBlock(client) - (opts?.finalityBlocks ?? 0);

        if (TotalEntityIndexTrait.toComponents(from).blockNumber >= toBlock) {
          await sleep(5000);
          continue;
        }

        const { events, latestCommittedMerkleIndex: newLatestCommittedMerkleIndex } = await fetchSdkEventsAndLatestCommittedMerkleIndex(client, from, toBlock);

        // if there are sdk events, produce the requisite diff.
        // otherwise, see if latestCommittedMerkleIndex changed - if so, yield an empty state diff with the new merkle index
        if (events.length > 0) {
          latestCommittedMerkleIndex = newLatestCommittedMerkleIndex;
          const highestTotalEntityIndex = maxArray(events.map(e => e.totalEntityIndex));

          const notes = events.filter(
            ({ inner }) => typeof inner === "object"
          ) as WithTotalEntityIndex<IncludedNote | IncludedEncryptedNote>[];

          const nullifiers = events.filter(
            ({ inner }) => typeof inner === "bigint"
          ) as WithTotalEntityIndex<Nullifier>[];

          const filledBatchEndIndices = events 
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

          console.log("yielding state diff", { stateDiff });

          yield stateDiff;

          from = highestTotalEntityIndex + 1n;
        } else {
          const toBlockTEI = TotalEntityIndexTrait.fromBlockNumber(toBlock, "THROUGH");

          if (latestCommittedMerkleIndex && newLatestCommittedMerkleIndex && newLatestCommittedMerkleIndex > latestCommittedMerkleIndex) {
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

    return new ClosableAsyncIterator(generator(), async () => { closed = true; });
  }

  async getLatestIndexedBlock(): Promise<number> {
    return await fetchLatestIndexedBlock(this.client);
  }
}

