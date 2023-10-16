import {
  merkleIndexToSubtreeIndex,
  TotalEntityIndexTrait,
  TotalEntityIndex,
  WithTotalEntityIndex,
  IncludedEncryptedNote,
  IncludedNote,
  SubgraphUtils,
  StealthAddressTrait,
  AssetTrait,
} from "@nocturne-xyz/core";
import { ethers } from "ethers";

const { makeSubgraphQuery, fetchLatestCommittedMerkleIndex } = SubgraphUtils;

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

// it's a plaintext note iff only those fields and merkleIndex are non-null
// it's an encrypted note iff only those fields and merkleIndex are non-null
// it's a tree batch fill iff only `merkleIndex` is non-null
export interface TreeInsertionEventResponse {
  id: string;

  // merkle index of the insertion
  // in the case of a note, this is the merkle index for the note
  // in the case of a tree batch being filled with zeros, this is the first index of the batch
  merkleIndex: string;

  // plaintext note insertion (from a deposit or refund)
  encodedNoteOwnerH1: string | null;
  encodedNoteOwnerH2: string | null;
  encodedNoteNonce: string | null;
  encodedNoteEncodedAssetAddr: string | null;
  encodedNoteEncodedAssetId: string | null;
  encodedNoteValue: string | null;

  // encrypted note insertion (from a joinsplit)
  encryptedNoteCiphertextBytes: string | null;
  encryptedNoteEncapsulatedSecretBytes: string | null;
  encryptedNoteCommitment: string | null;

  // tree batch filled with zeros
  filledBatchWithZerosNumZeros: string | null;
}

interface FetchTreeInsertionsResponse {
  data: {
    treeInsertionEvents: TreeInsertionEventResponse[];
  };
}

interface FetchTreeInsertionsVars {
  fromIdx: string;
}

function makeTreeInsertionsQuery(toIdx?: TotalEntityIndex) {
  const where = toIdx
    ? `{ id_gte: $fromIdx, id_lt: "${toIdx.toString()}" }`
    : "{ id_gte: $fromIdx }";
  return `\
query fetchTreeInsertionEvents($fromIdx: String!) {
  treeInsertionEvents(where: ${where}) {
    id

    merkleIndex
  
    encodedNoteOwnerH1
    encodedNoteOwnerH2
    encodedNoteNonce
    encodedNoteEncodedAssetAddr
    encodedNoteEncodedAssetId
    encodedNoteValue
  
    encryptedNoteCiphertextBytes
    encryptedNoteEncapsulatedSecretBytes
    encryptedNoteCommitment
  
    filledBatchWithZerosNumZeros
  }
}`;
}

export async function fetchTreeInsertions(
  endpoint: string,
  fromTotalEntityIndex: TotalEntityIndex,
  toTotalEntityIndex?: TotalEntityIndex
): Promise<WithTotalEntityIndex<TreeInsertion>[]> {
  const query = makeSubgraphQuery<
    FetchTreeInsertionsVars,
    FetchTreeInsertionsResponse
  >(
    endpoint,
    makeTreeInsertionsQuery(toTotalEntityIndex),
    "treeInsertionEvents"
  );

  const fromIdx = TotalEntityIndexTrait.toStringPadded(fromTotalEntityIndex);
  const res = await query({ fromIdx });

  if (!res.data || res.data.treeInsertionEvents.length === 0) {
    return [];
  }

  return res.data.treeInsertionEvents.map((res) => {
    const totalEntityIndex = BigInt(res.id);

    const event =
      tryIncludedNoteFromTreeInsertionEventResponse(res) ??
      tryIncludedEncryptedNoteFromTreeInsertionEventResponse(res) ??
      tryFilledBatchWithZerosEventFromTreeInsertionEventResponse(res);

    if (!event) {
      throw new Error("invalid tree insertion event");
    }

    return {
      totalEntityIndex,
      inner: event,
    };
  });
}

function tryIncludedNoteFromTreeInsertionEventResponse(
  res: TreeInsertionEventResponse
): IncludedNote | undefined {
  if (
    res.encodedNoteOwnerH1 !== null &&
    res.encodedNoteOwnerH2 !== null &&
    res.encodedNoteEncodedAssetAddr !== null &&
    res.encodedNoteEncodedAssetId !== null &&
    res.encodedNoteValue !== null &&
    res.encodedNoteNonce !== null &&
    res.encryptedNoteCiphertextBytes === null &&
    res.encryptedNoteEncapsulatedSecretBytes === null &&
    res.encryptedNoteCommitment === null &&
    res.filledBatchWithZerosNumZeros === null
  ) {
    return {
      owner: StealthAddressTrait.decompress({
        h1: BigInt(res.encodedNoteOwnerH1),
        h2: BigInt(res.encodedNoteOwnerH2),
      }),
      asset: AssetTrait.decode({
        encodedAssetAddr: BigInt(res.encodedNoteEncodedAssetAddr),
        encodedAssetId: BigInt(res.encodedNoteEncodedAssetId),
      }),
      value: BigInt(res.encodedNoteValue),
      nonce: BigInt(res.encodedNoteNonce),
      merkleIndex: parseInt(res.merkleIndex),
    };
  }

  return undefined;
}

function tryIncludedEncryptedNoteFromTreeInsertionEventResponse(
  res: TreeInsertionEventResponse
): IncludedEncryptedNote | undefined {
  if (
    res.encryptedNoteCiphertextBytes !== null &&
    res.encryptedNoteEncapsulatedSecretBytes !== null &&
    res.encryptedNoteCommitment !== null &&
    res.encodedNoteOwnerH1 === null &&
    res.encodedNoteOwnerH2 === null &&
    res.encodedNoteNonce === null &&
    res.encodedNoteEncodedAssetAddr === null &&
    res.encodedNoteEncodedAssetId === null &&
    res.encodedNoteValue === null &&
    res.filledBatchWithZerosNumZeros === null
  ) {
    return {
      ciphertextBytes: Array.from(
        ethers.utils.arrayify(res.encryptedNoteCiphertextBytes)
      ),
      encapsulatedSecretBytes: Array.from(
        ethers.utils.arrayify(res.encryptedNoteEncapsulatedSecretBytes)
      ),
      commitment: BigInt(res.encryptedNoteCommitment),
      merkleIndex: parseInt(res.merkleIndex),
    };
  }

  return undefined;
}

function tryFilledBatchWithZerosEventFromTreeInsertionEventResponse(
  res: TreeInsertionEventResponse
): FilledBatchWithZerosEvent | undefined {
  if (
    res.filledBatchWithZerosNumZeros !== null &&
    res.encodedNoteOwnerH1 === null &&
    res.encodedNoteOwnerH2 === null &&
    res.encodedNoteNonce === null &&
    res.encodedNoteEncodedAssetAddr === null &&
    res.encodedNoteEncodedAssetId === null &&
    res.encodedNoteValue === null &&
    res.encryptedNoteCiphertextBytes === null &&
    res.encryptedNoteEncapsulatedSecretBytes === null &&
    res.encryptedNoteCommitment === null
  ) {
    return {
      numZeros: parseInt(res.filledBatchWithZerosNumZeros),
      merkleIndex: parseInt(res.merkleIndex),
    };
  }

  return undefined;
}

export async function fetchLatestSubtreeIndex(
  endpoint: string
): Promise<number | undefined> {
  const latestCommittedMerkleIndex = await fetchLatestCommittedMerkleIndex(
    endpoint
  );
  return latestCommittedMerkleIndex
    ? merkleIndexToSubtreeIndex(latestCommittedMerkleIndex)
    : undefined;
}

interface FetchTeiVars {
  merkleIndex: string;
}

interface FetchTeiNoteResponse {
  id: string;
  merkleIndex: string;
}

interface FetchTeiBatchResponse {
  id: string;
  startIndex: string;
}

interface FetchTeiResponse {
  data: {
    encodedOrEncryptedNotes: FetchTeiNoteResponse[];
    filledBatchWithZerosEvents: FetchTeiBatchResponse[];
  };
}

const fetchTeiQuery = `
query fetchTeiFromMerkleIndex($merkleIndex: BigInt!) {
	encodedOrEncryptedNotes(where:{merkleIndex_lte: $merkleIndex}, first:1, orderBy:merkleIndex, orderDirection:desc) {
		id
    merkleIndex
	}
	filledBatchWithZerosEvents(where:{startIndex_lte: $merkleIndex},  first:1, orderBy:startIndex, orderDirection:desc) {
		id
    startIndex 
	}
}`;

// if `merkleIndex` has been "included" some tree insertion
// event in the subgraph, will return the TEI of the corresponding entity
// otherwise, it will return undefined.
//
// Note: if `merkleIndex` falls in the middle of a batch of zeros, this will
// return the start index of the batch.
export async function fetchTeiFromMerkleIndex(
  endpoint: string,
  merkleIndex: number
): Promise<bigint | undefined> {
  const query = makeSubgraphQuery<FetchTeiVars, FetchTeiResponse>(
    endpoint,
    fetchTeiQuery,
    "TeiFromMerkleIndex"
  );
  const res = await query({ merkleIndex: merkleIndex.toString() });
  if (
    !res.data ||
    (res.data.encodedOrEncryptedNotes.length === 0 &&
      res.data.filledBatchWithZerosEvents.length === 0)
  ) {
    return undefined;
  }

  // pick the result with the greatest merkle index
  const note =
    res.data.encodedOrEncryptedNotes.length > 0
      ? res.data.encodedOrEncryptedNotes[0]
      : undefined;
  const batch =
    res.data.filledBatchWithZerosEvents.length > 0
      ? res.data.filledBatchWithZerosEvents[0]
      : undefined;
  if (!note) {
    // only batch defined
    return BigInt((batch as FetchTeiBatchResponse).id);
  } else if (!batch) {
    // only note defined
    return BigInt(note.id);
  }

  // both defined
  const max =
    parseInt(note.merkleIndex) > parseInt(batch.startIndex) ? note : batch;
  return BigInt(max.id);
}
