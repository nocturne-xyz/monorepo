import { StealthAddressTrait } from "../../../crypto";
import {
  AssetTrait,
  IncludedEncryptedNote,
  IncludedNote,
  WithTimestamp,
} from "../../../primitives";
import {
  maxArray,
  batchOffsetToLatestMerkleIndexInBatch,
} from "../../../utils";
import {
  blockNumberFromTotalEntityIndex,
  makeSubgraphQuery,
  totalEntityIndexFromBlockNumber,
} from "../utils";

export interface NoteResponse {
  ownerH1: string;
  ownerH2: string;
  nonce: string;
  encodedAssetAddr: string;
  encodedAssetId: string;
  value: string;
}

export interface EncryptedNoteResponse {
  id: string;
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
  merkleIndex: string;
  idx: string;
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
  toIdx: string;
}

const notesQuery = `\
query fetchNotes($fromIdx: Bytes!, $toIdx: Bytes!) {
  encodedOrEncryptedNotes(where: { idx_gte: $fromIdx, idx_lt: $toIdx}) {
    idx
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

// gets notes or encrypted notes for a given block range
// the range is inclusive - i.e. [fromBlock, toBlock]
export async function fetchNotes(
  endpoint: string,
  fromBlock: number,
  toBlock: number
): Promise<WithTimestamp<IncludedNote | IncludedEncryptedNote>[]> {
  const query = makeSubgraphQuery<FetchNotesVars, FetchNotesResponse>(
    endpoint,
    notesQuery,
    "notes"
  );

  const fromIdx = totalEntityIndexFromBlockNumber(BigInt(fromBlock)).toString();
  const toIdx = totalEntityIndexFromBlockNumber(BigInt(toBlock + 1)).toString();

  const res = await query({ fromIdx, toIdx });

  if (!res.data || res.data.encodedOrEncryptedNotes.length === 0) {
    return [];
  }

  return res.data.encodedOrEncryptedNotes.map(
    ({ merkleIndex, note, encryptedNote, idx }) => {
      const timestampUnixMillis = Number(
        blockNumberFromTotalEntityIndex(BigInt(idx))
      );
      if (note) {
        return {
          inner: includedNoteFromNoteResponse(note, parseInt(merkleIndex)),
          timestampUnixMillis,
        };
      } else if (encryptedNote) {
        return {
          inner: encryptedNoteFromEncryptedNoteResponse(
            encryptedNote,
            parseInt(merkleIndex)
          ),
          timestampUnixMillis,
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
  toBlock: number;
}

interface SubtreeCommitResponse {
  subtreeBatchOffset: string;
}

const subtreeCommitQuery = `
  query fetchSubtreeCommits($toBlock: Int!) {
    subtreeCommits(block: { number: $toBlock }, orderBy: subtreeBatchOffset, orderDirection: desc, first: 1) {
      subtreeBatchOffset
    }
  }
`;

// gets last committed merkle index for a given block range
// the range is inclusive - i.e. [fromBlock, toBlock]
export async function fetchLastCommittedMerkleIndex(
  endpoint: string,
  toBlock: number
): Promise<number | undefined> {
  const query = makeSubgraphQuery<
    FetchSubtreeCommitsVars,
    FetchSubtreeCommitsResponse
  >(endpoint, subtreeCommitQuery, "last committed merkle index");
  const res = await query({ toBlock });

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
  toIdx: string;
}

interface NullifierResponse {
  nullifier: string;
}

const nullifiersQuery = `
  query fetchNullifiers($fromIdx: Bytes!, $toIdx: Bytes!) {
    nullifiers(where: { idx_gte: $fromIdx, idx_lt: $toIdx}) {
      nullifier
    }
  }
`;

// gets nullifiers for a given block range
// the range is inclusive - i.e. [fromBlock, toBlock]
export async function fetchNullifiers(
  endpoint: string,
  fromBlock: number,
  toBlock: number
): Promise<bigint[]> {
  const query = makeSubgraphQuery<FetchNullifiersVars, FetchNullifiersResponse>(
    endpoint,
    nullifiersQuery,
    "nullifiers"
  );

  const fromIdx = totalEntityIndexFromBlockNumber(BigInt(fromBlock)).toString();
  const toIdx = totalEntityIndexFromBlockNumber(BigInt(toBlock + 1)).toString();

  const res = await query({ fromIdx, toIdx });

  if (!res.data || res.data.nullifiers.length === 0) {
    return [];
  }

  return res.data.nullifiers.map(({ nullifier }) => BigInt(nullifier));
}