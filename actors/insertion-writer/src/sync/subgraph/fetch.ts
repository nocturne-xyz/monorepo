import {
  fetchlatestCommittedMerkleIndex,
  merkleIndexToSubtreeIndex,
  TotalEntityIndexTrait,
  TotalEntityIndex,
  WithTotalEntityIndex,
  IncludedEncryptedNote,
  IncludedNote,
  EncodedOrEncryptedNoteResponse,
  encryptedNoteFromEncryptedNoteResponse,
  includedNoteFromNoteResponse,
  SubgraphUtils,
} from "@nocturne-xyz/core";

const { makeSubgraphQuery } = SubgraphUtils;

export type TreeInsertion =
  | FilledBatchWithZerosEvent
  | IncludedNote
  | IncludedEncryptedNote;

export interface FilledBatchWithZerosEvent {
  merkleIndex: number; // start index
  numZeros: number;
}

export interface FilledBatchWithZerosEventResponse {
  startIndex: string;
  numZeros: string;
}

export interface TreeInsertionEventReponse {
  id: string;
  encodedOrEncryptedNote: Omit<EncodedOrEncryptedNoteResponse, "id"> | null;
  filledBatchWithZerosEvent: FilledBatchWithZerosEventResponse | null;
}

interface FetchTreeInsertionsResponse {
  data: {
    treeInsertionEvents: TreeInsertionEventReponse[];
  };
}

interface FetchTreeInsertionsVars {
  fromIdx: string;
}

const treeInsertionsQuery = `\
query fetchTreeInsertionEvents($fromIdx: String!) {
  treeInsertionEvents(where: { id_gte: $fromIdx }) {
    id
    encodedOrEncryptedNote {
      merkleIndex
      note {
        ownerH1
        ownerH2
        nonce
        encodedAssetAddr
        encodedAssetId
        value
      }
      encryptedNote {
        ciphertextBytes
        encapsulatedSecretBytes
        commitment
      }
    }
    filledBatchWithZerosEvent {
      startIndex
      numZeros
    }
  }
}`;

export async function fetchTreeInsertions(
  endpoint: string,
  fromTotalEntityIndex: TotalEntityIndex
): Promise<WithTotalEntityIndex<TreeInsertion>[]> {
  const query = makeSubgraphQuery<
    FetchTreeInsertionsVars,
    FetchTreeInsertionsResponse
  >(endpoint, treeInsertionsQuery, "treeInsertionEvents");

  const fromIdx = TotalEntityIndexTrait.toStringPadded(fromTotalEntityIndex);
  const res = await query({ fromIdx });

  if (!res.data || res.data.treeInsertionEvents.length === 0) {
    return [];
  }

  return res.data.treeInsertionEvents.map(
    ({ id, encodedOrEncryptedNote, filledBatchWithZerosEvent }) => {
      const totalEntityIndex = BigInt(id);

      // encrypted note
      if (encodedOrEncryptedNote && encodedOrEncryptedNote.encryptedNote) {
        const { encryptedNote, merkleIndex } = encodedOrEncryptedNote;
        return {
          inner: encryptedNoteFromEncryptedNoteResponse(
            encryptedNote,
            parseInt(merkleIndex)
          ),
          totalEntityIndex,
        };
      }

      // encoded note
      if (encodedOrEncryptedNote && encodedOrEncryptedNote.note) {
        const { note, merkleIndex } = encodedOrEncryptedNote;
        return {
          inner: includedNoteFromNoteResponse(note, parseInt(merkleIndex)),
          totalEntityIndex,
        };
      }

      // filled batch with zeros
      if (filledBatchWithZerosEvent) {
        const { startIndex, numZeros } = filledBatchWithZerosEvent;
        return {
          inner: {
            merkleIndex: parseInt(startIndex),
            numZeros: parseInt(numZeros),
          },
          totalEntityIndex,
        };
      }

      // should never happen
      throw new Error("invalid tree insertion event");
    }
  );
}

export async function fetchLatestSubtreeIndex(
  endpoint: string
): Promise<number | undefined> {
  const latestCommittedMerkleIndex = await fetchlatestCommittedMerkleIndex(
    endpoint
  );
  return latestCommittedMerkleIndex
    ? merkleIndexToSubtreeIndex(latestCommittedMerkleIndex)
    : undefined;
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
  };
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
// event in the subgraph, will return the corresponding TEI
// otherwise, it will return undefined.
//
// NOTE: if `merkleIndex` corresponds to a `FilledBatchWithZerosEvent`,
// and it's not the startIndex, this function will also return undefined
export async function fetchTeiFromMerkleIndex(
  endpoint: string,
  merkleIndex: number
): Promise<bigint | undefined> {
  const query = makeSubgraphQuery<FetchTeiVars, FetchTeiResponse>(
    endpoint,
    fetchTeiQuery,
    "TeiFromMerkleIndex"
  );
  const res = await query({ merkleIndex });
  if (
    !res.data ||
    (res.data.encodedOrEncryptedNotes.length === 0 &&
      res.data.filledBatchWithZerosEvents.length === 0)
  ) {
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
    throw new Error(
      "shit's fucked - found multiple tree insertion events with the same merkle index!"
    );
  }
}
