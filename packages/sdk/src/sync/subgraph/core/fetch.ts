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

export interface NoteResponse {
  ownerH1: string;
  ownerH2: string;
  nonce: string;
  encodedAssetAddr: string;
  encodedAssetId: string;
  value: string;
}

export interface EncryptedNoteResponse {
  ownerH1: string;
  ownerH2: string;
  encappedKey: string;
  encryptedNonce: string;
  encryptedValue: string;
  encodedAssetAddr: string;
  encodedAssetId: string;
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
    nonce,
    value,

    merkleIndex,
  };
}

export function encryptedNoteFromEncryptedNoteResponse(
  encryptedNoteResponse: EncryptedNoteResponse,
  merkleIndex: number
): IncludedEncryptedNote {
  const h1 = BigInt(encryptedNoteResponse.ownerH1);
  const h2 = BigInt(encryptedNoteResponse.ownerH2);
  const owner = { h1, h2 };

  const encodedAssetAddr = BigInt(encryptedNoteResponse.encodedAssetAddr);
  const encodedAssetId = BigInt(encryptedNoteResponse.encodedAssetId);
  const asset = AssetTrait.decode({ encodedAssetAddr, encodedAssetId });

  const encappedKey = BigInt(encryptedNoteResponse.encappedKey);
  const encryptedNonce = BigInt(encryptedNoteResponse.encryptedNonce);
  const encryptedValue = BigInt(encryptedNoteResponse.encryptedValue);
  const commitment = BigInt(encryptedNoteResponse.commitment);

  return {
    owner,
    encappedKey,
    encryptedNonce,
    encryptedValue,

    merkleIndex,
    asset,
    commitment,
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
export async function fetchLastCommittedMerkleIndex(
  endpoint: string,
  toTotalEntityIndex?: TotalEntityIndex
): Promise<number | undefined> {
  let params = "";
  let whereClause = "";
  if (toTotalEntityIndex) {
    params = "($toIdx: String!)";
    whereClause = "where: { id_lt: $toIdx }, ";
  }

  const query = makeSubgraphQuery<
    FetchSubtreeCommitsVars,
    FetchSubtreeCommitsResponse
  >(
    endpoint,
    subtreeCommitQuery(params, whereClause),
    "last committed merkle index"
  );

  const toIdx = toTotalEntityIndex
    ? TotalEntityIndexTrait.toStringPadded(toTotalEntityIndex)
    : undefined;
  const res = await query({ toIdx });

  if (!res.data || res.data.subtreeCommits.length === 0) {
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
