import {
  SubgraphUtils,
  fetchLastCommittedMerkleIndex,
  merkleIndexToSubtreeIndex,
} from "@nocturne-xyz/sdk";
import { makeSubgraphQuery } from "@nocturne-xyz/sdk/dist/src/sync/subgraph/utils";

const { fetchLatestIndexedBlock, totalEntityIndexFromBlockNumber } =
  SubgraphUtils;

export interface FilledBatchWithZerosEvent {
  merkleIndex: number; // start index
  numZeros: number;
}

export interface FilledBatchWithZerosResponse {
  startIndex: string;
  numZeros: string;
}

interface FetchFilledBatchWithZerosEventsResponse {
  data: {
    filledBatchWithZerosEvents: FilledBatchWithZerosResponse[];
  };
}

interface FetchFilledBatchWithZerosEventsVars {
  fromIdx: string;
  toIdx: string;
}

const filledBatchWithZerosQuery = `\
query fetchFilledBatchWithZerosEvents($fromIdx: Bytes!, $toIdx: Bytes!) {
  filledBatchWithZerosEvents(where: { idx_gte: $fromIdx, idx_lt: $toIdx}, orderBy: idx) {
    startIndex
    numZeros
  }
}`;

export async function fetchFilledBatchWithZerosEvents(
  endpoint: string,
  fromBlock: number,
  toBlock: number
): Promise<FilledBatchWithZerosEvent[]> {
  const query = makeSubgraphQuery<
    FetchFilledBatchWithZerosEventsVars,
    FetchFilledBatchWithZerosEventsResponse
  >(endpoint, filledBatchWithZerosQuery, "filledBatchWithZeros");

  const fromIdx = totalEntityIndexFromBlockNumber(BigInt(fromBlock)).toString();
  const toIdx = totalEntityIndexFromBlockNumber(BigInt(toBlock + 1)).toString();

  const res = await query({ fromIdx, toIdx });

  if (!res.data || res.data.filledBatchWithZerosEvents.length === 0) {
    return [];
  }

  return res.data.filledBatchWithZerosEvents.map(
    ({ startIndex, numZeros }) => ({
      merkleIndex: parseInt(startIndex),
      numZeros: parseInt(numZeros),
    })
  );
}

export async function fetchLatestSubtreeIndex(
  endpoint: string
): Promise<number | undefined> {
  const latestIndexedBlock = await fetchLatestIndexedBlock(endpoint);
  const lastCommittedMerkleIndex = await fetchLastCommittedMerkleIndex(
    endpoint,
    latestIndexedBlock
  );
  return lastCommittedMerkleIndex
    ? merkleIndexToSubtreeIndex(lastCommittedMerkleIndex)
    : undefined;
}
