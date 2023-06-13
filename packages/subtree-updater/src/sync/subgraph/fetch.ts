import {
  fetchLastCommittedMerkleIndex,
  merkleIndexToSubtreeIndex,
  TotalEntityIndexTrait,
  TotalEntityIndex,
} from "@nocturne-xyz/sdk";
import { makeSubgraphQuery } from "@nocturne-xyz/sdk/dist/src/sync/subgraph/utils";

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
}

const filledBatchWithZerosQuery = `\
query fetchFilledBatchWithZerosEvents($fromIdx: String!) {
  filledBatchWithZerosEvents(where: { id_gte: $fromIdx }, first: 100) {
    startIndex
    numZeros
  }
}`;

export async function fetchFilledBatchWithZerosEvents(
  endpoint: string,
  fromTotalEntityIndex: TotalEntityIndex
): Promise<FilledBatchWithZerosEvent[]> {
  const query = makeSubgraphQuery<
    FetchFilledBatchWithZerosEventsVars,
    FetchFilledBatchWithZerosEventsResponse
  >(endpoint, filledBatchWithZerosQuery, "filledBatchWithZeros");

  const fromIdx = TotalEntityIndexTrait.toStringPadded(fromTotalEntityIndex);
  const res = await query({ fromIdx });

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
  const lastCommittedMerkleIndex = await fetchLastCommittedMerkleIndex(
    endpoint
  );
  return lastCommittedMerkleIndex
    ? merkleIndexToSubtreeIndex(lastCommittedMerkleIndex)
    : undefined;
}
