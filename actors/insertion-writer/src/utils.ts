import { SubgraphUtils } from "@nocturne-xyz/core";


const { makeSubgraphQuery } = SubgraphUtils;

export function merkleIndexToRedisStreamId(merkleIndex: number): string {
	return `${merkleIndex}-1`
}

export function merkleIndexFromRedisStreamId(id: string): number {
	const components = id.split('-');
	if (!components || components.length !== 2) {
		throw new Error("invalid id");
	}

	try {
		const res = parseInt(components[0]);
		if (res < 0 || isNaN(res)) {
			throw new Error("invalid id");
		}
		return res;
	} catch {
		throw new Error("invalid id");
	}
}

interface FetchTeiVars {
	merkleIndex: number;
}

interface FetchTeiResponse {
	data: {
		encodedOrEncryptedNotes: {
			id: string;
		}[];
		filledBatchWithZerosEvents: {
			id: string;
		}[];
	}
}

const fetchTeiQuery = `
query fetchTeiFromMerkleIndex($merkleIndex: Int!) {
	encodedOrEncryptedNotes(where:{merkleIndex: $merkleIndex}) {
		id
	}
	filledBatchWithZerosEvents(where:{startIndex: $merkleIndex}) {
		id
	}
}`;

// if `merkleIndex` has been seen in by some tree insertion
// event in the subgraph, will return the corresponding merkle index
// otherwise, it will return undefined.
export async function fetchTeiFromMerkleIndex(endpoint: string, merkleIndex: number): Promise<bigint | undefined> {
	const query = makeSubgraphQuery<FetchTeiVars, FetchTeiResponse>(endpoint, fetchTeiQuery, "TeiFromMerkleIndex");
	const res = await query({ merkleIndex });
	if (!res.data) {
		return undefined;
	}

	// if we got a result, it's guaranteed that exactly one of these two sub-queries will return exactly one result
	// this is because, between these two events, we have a total ordering on merkle indices - that is, each merkle index
	// will correspond to exactly one of an `EncodedOrEncryptedNote` or a `FilledBatchWithZerosEvent` (not both or neither).
	if (res.data.encodedOrEncryptedNotes.length === 1) {
		return BigInt(res.data.encodedOrEncryptedNotes[0].id);
	} else if (res.data.filledBatchWithZerosEvents.length === 1) {
		return BigInt(res.data.filledBatchWithZerosEvents[0].id);
	} else {
		// ! should never happen!
		throw new Error("shit's fucked - found multiple tree insertion events with the same merkle index!");
	}
}
