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
} from "@nocturne-xyz/wallet-sdk";
import { makeSubgraphQuery } from "@nocturne-xyz/wallet-sdk/dist/src/sync/subgraph/utils";

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
        ownerH1
        ownerH2
        encappedKey
        encryptedNonce
        encryptedValue
        encodedAssetAddr
        encodedAssetId
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
