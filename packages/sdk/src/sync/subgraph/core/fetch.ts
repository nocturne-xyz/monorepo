import { StealthAddressTrait } from "../../../crypto";
import {
  AssetTrait,
  IncludedEncryptedNote,
  IncludedNote,
  Nullifier,
} from "../../../primitives";
import {
  maxArray,
  batchOffsetToLatestMerkleIndexInBatch,
} from "../../../utils";
import { makeSubgraphQuery } from "../utils";
import {
  TotalEntityIndex,
  TotalEntityIndexTrait,
  WithTotalEntityIndex,
} from "../../totalEntityIndex";
import { ethers } from "ethers";

export type FilledBatchWithZerosEndMerkleIndex = number;
export type SDKEvent =
  | IncludedNote
  | IncludedEncryptedNote
  | Nullifier
  | FilledBatchWithZerosEndMerkleIndex;

export interface SDKEventResponse {
  id: string;
  encodedOrEncryptedNote: Omit<EncodedOrEncryptedNoteResponse, "id"> | null;
  nullifier: Omit<NullifierResponse, "id"> | null;
  filledBatchWithZerosUpToMerkleIndex: string | null;
}

export interface SDKEventsResponse {
  data: {
    sdkevents: SDKEventResponse[];
  };
}

export interface FetchSDKEventsVars {
  fromIdx: string;
}

const sdkEventsQuery = `\
query fetchSDKEvents($fromIdx: String!) {
  sdkevents(where: { id_gte: $fromIdx }, first: 100) {
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
    nullifier {
      nullifier
    }
    filledBatchWithZerosUpToMerkleIndex 
  }
}
`;

export async function fetchSDKEvents(
  endpoint: string,
  fromTotalEntityIndex: TotalEntityIndex
): Promise<WithTotalEntityIndex<SDKEvent>[]> {
  const query = makeSubgraphQuery<FetchSDKEventsVars, SDKEventsResponse>(
    endpoint,
    sdkEventsQuery,
    "sdkEvents"
  );

  const fromIdx = TotalEntityIndexTrait.toStringPadded(fromTotalEntityIndex);
  const res = await query({ fromIdx });

  if (!res.data || res.data.sdkevents.length === 0) {
    return [];
  }

  return res.data.sdkevents.map(
    ({
      id,
      encodedOrEncryptedNote,
      nullifier,
      filledBatchWithZerosUpToMerkleIndex,
    }) => {
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

      // nullifier
      if (nullifier) {
        return {
          inner: BigInt(nullifier.nullifier),
          totalEntityIndex,
        };
      }

      // filledBatchWithZerosUpToMerkleIndexA
      if (filledBatchWithZerosUpToMerkleIndex) {
        return {
          inner: Number(BigInt(filledBatchWithZerosUpToMerkleIndex)),
          totalEntityIndex,
        };
      }

      // should never happen
      throw new Error("invalid sdk event");
    }
  );
}

export interface NoteResponse {
  ownerH1: string;
  ownerH2: string;
  nonce: string;
  encodedAssetAddr: string;
  encodedAssetId: string;
  value: string;
}

export interface EncryptedNoteResponse {
  ciphertextBytes: string;
  encapsulatedSecretBytes: string;
  commitment: string;
}

export interface EncodedOrEncryptedNoteResponse {
  id: string;
  merkleIndex: string;
  note: NoteResponse | null;
  encryptedNote: EncryptedNoteResponse | null;
}

interface FetchNotesResponse {
  data: {
    encodedOrEncryptedNotes: EncodedOrEncryptedNoteResponse[];
  };
}

interface FetchNotesVars {
  fromIdx: string;
}

const notesQuery = `\
query fetchNotes($fromIdx: String!) {
  encodedOrEncryptedNotes(where: { id_gte: $fromIdx }, first: 100) {
    id,
    merkleIndex
    note {
      ownerH1
      ownerH2
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
}`;

// gets first 100 notes on or after a given totalEntityIndex
export async function fetchNotes(
  endpoint: string,
  fromTotalEntityIndex: TotalEntityIndex
): Promise<WithTotalEntityIndex<IncludedNote | IncludedEncryptedNote>[]> {
  const query = makeSubgraphQuery<FetchNotesVars, FetchNotesResponse>(
    endpoint,
    notesQuery,
    "notes"
  );

  const fromIdx = TotalEntityIndexTrait.toStringPadded(fromTotalEntityIndex);
  const res = await query({ fromIdx });

  if (!res.data || res.data.encodedOrEncryptedNotes.length === 0) {
    return [];
  }

  return res.data.encodedOrEncryptedNotes.map(
    ({ merkleIndex, note, encryptedNote, id }) => {
      if (note) {
        return {
          inner: includedNoteFromNoteResponse(note, parseInt(merkleIndex)),
          totalEntityIndex: BigInt(id),
        };
      } else if (encryptedNote) {
        return {
          inner: encryptedNoteFromEncryptedNoteResponse(
            encryptedNote,
            parseInt(merkleIndex)
          ),
          totalEntityIndex: BigInt(id),
        };
      } else {
        throw new Error("res must contain either note or encryptedNote");
      }
    }
  );
}

export function includedNoteFromNoteResponse(
  noteResponse: NoteResponse,
  merkleIndex: number
): IncludedNote {
  const h1 = BigInt(noteResponse.ownerH1);
  const h2 = BigInt(noteResponse.ownerH2);
  const owner = StealthAddressTrait.decompress({ h1, h2 });

  const encodedAssetAddr = BigInt(noteResponse.encodedAssetAddr);
  const encodedAssetId = BigInt(noteResponse.encodedAssetId);
  const asset = AssetTrait.decode({ encodedAssetAddr, encodedAssetId });
  const nonce = BigInt(noteResponse.nonce);

  const value = BigInt(noteResponse.value);

  return {
    owner,
    asset,
    value,
    nonce,
    merkleIndex,
  };
}

export function encryptedNoteFromEncryptedNoteResponse(
  encryptedNoteResponse: EncryptedNoteResponse,
  merkleIndex: number
): IncludedEncryptedNote {
  const ciphertextBytes = Array.from(
    ethers.utils.arrayify(encryptedNoteResponse.ciphertextBytes)
  );
  const encapsulatedSecretBytes = Array.from(
    ethers.utils.arrayify(encryptedNoteResponse.encapsulatedSecretBytes)
  );
  const commitment = BigInt(encryptedNoteResponse.commitment);

  return {
    ciphertextBytes,
    encapsulatedSecretBytes,
    commitment,
    merkleIndex,
  };
}

interface FetchSubtreeCommitsResponse {
  data: {
    subtreeCommits: SubtreeCommitResponse[];
  };
}

interface FetchSubtreeCommitsVars {
  toIdx?: string;
}

interface SubtreeCommitResponse {
  subtreeBatchOffset: string;
}

const subtreeCommitQuery = (params: string, whereClause: string) => `
  query fetchSubtreeCommits${params} {
    subtreeCommits(${whereClause}orderBy: subtreeBatchOffset, orderDirection: desc, first: 1) {
      subtreeBatchOffset
    }
  }
`;

// gets last committed merkle index on or before a given totalEntityIndex
export async function fetchlatestCommittedMerkleIndex(
  endpoint: string,
  toTotalEntityIndex?: TotalEntityIndex
): Promise<number | undefined> {
  let params = "";
  let whereClause = "";
  if (toTotalEntityIndex) {
    params = "($toIdx: String!)";
    whereClause = "where: { id_lt: $toIdx }, ";
  }

  const rawQuery = subtreeCommitQuery(params, whereClause);

  const query = makeSubgraphQuery<
    FetchSubtreeCommitsVars,
    FetchSubtreeCommitsResponse
  >(endpoint, rawQuery, "last committed merkle index");

  const toIdx = toTotalEntityIndex
    ? TotalEntityIndexTrait.toStringPadded(toTotalEntityIndex)
    : undefined;
  const res = await query({ toIdx });

  if (!res.data) {
    throw new Error(
      "received empty response from subgraph when fetching lastCommittedMerkleIndex"
    );
  }

  if (res.data.subtreeCommits.length === 0) {
    return undefined;
  }

  const subtreeBatchOffsets = res.data.subtreeCommits.map((commit) =>
    parseInt(commit.subtreeBatchOffset)
  );
  const maxSubtreeBatchOffset = maxArray(subtreeBatchOffsets);

  return batchOffsetToLatestMerkleIndexInBatch(maxSubtreeBatchOffset);
}

interface FetchNullifiersResponse {
  data: {
    nullifiers: NullifierResponse[];
  };
}

interface FetchNullifiersVars {
  fromIdx: string;
}

interface NullifierResponse {
  id: string;
  nullifier: string;
}

const nullifiersQuery = `
  query fetchNullifiers($fromIdx: String!) {
    nullifiers(where: { id_gte: $fromIdx }, first: 100) {
      id,
      nullifier
    }
  }
`;

// gets first 100 nullifiers on or after a given totalEntityIndex
export async function fetchNullifiers(
  endpoint: string,
  fromTotalEntityIndex: TotalEntityIndex
): Promise<WithTotalEntityIndex<Nullifier>[]> {
  const query = makeSubgraphQuery<FetchNullifiersVars, FetchNullifiersResponse>(
    endpoint,
    nullifiersQuery,
    "nullifiers"
  );

  const fromIdx = TotalEntityIndexTrait.toStringPadded(fromTotalEntityIndex);
  const res = await query({ fromIdx });

  if (!res.data || res.data.nullifiers.length === 0) {
    return [];
  }

  return res.data.nullifiers.map(({ id, nullifier }) => ({
    inner: BigInt(nullifier),
    totalEntityIndex: BigInt(id),
  }));
}
