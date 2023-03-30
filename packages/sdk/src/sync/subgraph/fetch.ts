import { StealthAddress } from "../../crypto";
import {
  AssetTrait,
  BinaryPoseidonTree,
  IncludedEncryptedNote,
  IncludedNote,
} from "../../primitives";
import { maxArray } from "../../utils";

interface NoteResponse {
  ownerH1X: string;
  ownerH1Y: string;
  ownerH2X: string;
  ownerH2Y: string;
  nonce: string;
  encodedAssetAddr: string;
  encodedAssetId: string;
  value: string;
}

interface EncryptedNoteResponse {
  id: string;
  ownerH1X: string;
  ownerH1Y: string;
  ownerH2X: string;
  ownerH2Y: string;
  encappedKey: string;
  encryptedNonce: string;
  encryptedValue: string;
  encodedAssetAddr: string;
  encodedAssetId: string;
  commitment: string;
}

interface EncodedOrEncryptedNoteResponse {
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
  fromID: string;
  toID: string;
}

const notesQuery = `\
query fetchNotes($fromID: Bytes!, $toID: Bytes!) {
  encodedOrEncryptedNotes(where: { id_gte: $fromID, id_lt: $toID}) {
    merkleIndex
    note {
      ownerH1X
      ownerH1Y
      ownerH2X
      ownerH2Y
      nonce
      encodedAssetAddr
      encodedAssetId
      value
    }
    encryptedNote {
      ownerH1X
      ownerH1Y
      ownerH2X
      ownerH2Y
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
): Promise<(IncludedNote | IncludedEncryptedNote)[]> {
  const query = makeSubgraphQuery<FetchNotesVars, FetchNotesResponse>(
    endpoint,
    notesQuery,
    "notes"
  );

  const fromID = entityIdWithEntityIndexFromBlockNumber(BigInt(fromBlock));
  const toID = entityIdWithEntityIndexFromBlockNumber(BigInt(toBlock + 1));

  const res = await query({ fromID, toID });
  return res.data.encodedOrEncryptedNotes.map(
    ({ merkleIndex, note, encryptedNote }) => {
      if (note) {
        return includedNoteFromNoteResponse(note, parseInt(merkleIndex));
      } else if (encryptedNote) {
        return encryptedNoteFromEncryptedNoteResponse(
          encryptedNote,
          parseInt(merkleIndex)
        );
      } else {
        throw new Error("res must contain either note or encryptedNote");
      }
    }
  );
}

function includedNoteFromNoteResponse(
  noteResponse: NoteResponse,
  merkleIndex: number
): IncludedNote {
  const h1X = BigInt(noteResponse.ownerH1X);
  const h1Y = BigInt(noteResponse.ownerH1Y);
  const h2X = BigInt(noteResponse.ownerH2X);
  const h2Y = BigInt(noteResponse.ownerH2Y);
  const owner: StealthAddress = {
    h1X,
    h1Y,
    h2X,
    h2Y,
  };

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

function encryptedNoteFromEncryptedNoteResponse(
  encryptedNoteResponse: EncryptedNoteResponse,
  merkleIndex: number
): IncludedEncryptedNote {
  const h1X = BigInt(encryptedNoteResponse.ownerH1X);
  const h1Y = BigInt(encryptedNoteResponse.ownerH1Y);
  const h2X = BigInt(encryptedNoteResponse.ownerH2X);
  const h2Y = BigInt(encryptedNoteResponse.ownerH2Y);
  const owner: StealthAddress = {
    h1X,
    h1Y,
    h2X,
    h2Y,
  };

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
  newRoot: string;
  subtreeIndex: string;
}

const subtreeCommitQuery = `
  query fetchSubtreeCommits($toBlock: Int!) {
    subtreeCommits(block: { number: $toBlock }, orderBy: subtreeIndex, orderDirection: desc, first: 1) {
      subtreeIndex
    }
  }
`;

// gets last committed merkle index for a given block range
// the range is inclusive - i.e. [fromBlock, toBlock]
export async function fetchLastCommittedMerkleIndex(
  endpoint: string,
  toBlock: number
): Promise<number> {
  const query = makeSubgraphQuery<
    FetchSubtreeCommitsVars,
    FetchSubtreeCommitsResponse
  >(endpoint, subtreeCommitQuery, "last committed merkle index");
  const res = await query({ toBlock });
  if (res.data.subtreeCommits.length === 0) {
    return -1;
  } else {
    const subtreeIndices = res.data.subtreeCommits.map((commit) =>
      parseInt(commit.subtreeIndex)
    );
    const maxSubtreeIndex = maxArray(subtreeIndices);

    return (maxSubtreeIndex + 1) * BinaryPoseidonTree.BATCH_SIZE - 1;
  }
}

interface FetchNullifiersResponse {
  data: {
    nullifiers: NullifierResponse[];
  };
}

interface FetchNullifiersVars {
  fromID: string;
  toID: string;
}

interface NullifierResponse {
  nullifier: string;
}

const nullifiersQuery = `
  query fetchNullifiers($fromID: Bytes!, $toID: Bytes!) {
    nullifiers(where: { id_gte: $fromID, id_lt: $toID}) {
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

  const fromID = entityIdWithEntityIndexFromBlockNumber(BigInt(fromBlock));
  const toID = entityIdWithEntityIndexFromBlockNumber(BigInt(toBlock + 1));

  const res = await query({ fromID, toID });
  return res.data.nullifiers.map(({ nullifier }) => BigInt(nullifier));
}

// see https://thegraph.com/docs/en/querying/graphql-api/#subgraph-metadata
const latestIndexedBlockQuery = `
{
  _meta {
    block {
      number
    }
  }
}
`;

interface FetchLatestIndexedBlockResponse {
  data: {
    _meta: {
      block: {
        number: number;
      };
    };
  };
}

// gets the latest indexed block from the subgraph
export async function fetchLatestIndexedBlock(
  endpoint: string
): Promise<number> {
  const query = makeSubgraphQuery<undefined, FetchLatestIndexedBlockResponse>(
    endpoint,
    latestIndexedBlockQuery,
    "latest indexed block"
  );
  const res = await query(undefined);
  return res.data._meta.block.number;
}

export const makeSubgraphQuery =
  <T, U>(endpoint: string, query: string, dataLabel: string) =>
  async (variables: T): Promise<U> => {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`Failed to query ${dataLabel} from subgraph: ${text}`);

        throw new Error(`Failed to query ${dataLabel} from subgraph: ${text}`);
      }

      return (await response.json()) as U;
    } catch (err) {
      console.error(`Error when querying ${dataLabel} from subgraph`);
      throw err;
    }
  };

export function entityIdFromBlockNumber(blockNumber: bigint): string {
  return `0x${(blockNumber << 64n).toString(16).padStart(64, "0")}`;
}

export function entityIdWithEntityIndexFromBlockNumber(
  blockNumber: bigint
): string {
  return `0x${(blockNumber << 96n).toString(16).padStart(64, "0")}`;
}
