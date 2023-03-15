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

const notesQuery = `\
query fetchNotes($fromBlock: Int!, $toBlock: Int!) {
  encodedOrEncryptedNotes(block: { number: $toBlock, number_gte: $fromBlock }) {
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
// the range is exclusive - i.e. [fromBlock, toBlock]
export async function fetchNotes(
  endpoint: string,
  fromBlock: number,
  toBlock: number
): Promise<(IncludedNote | IncludedEncryptedNote)[]> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: notesQuery,
        variables: {
          fromBlock,
          toBlock: toBlock,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Failed to fetch notes from subgraph: ${text}`);

      throw new Error(`Failed to fetch notes from subgraph: ${text}`);
    }

    const res = (await response.json()) as FetchNotesResponse;

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
  } catch (err) {
    console.error("Error when fetching notes from subgraph");
    throw err;
  }
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

interface SubtreeCommitResponse {
  newRoot: string;
  subtreeIndex: string;
}

const subtreeCommitQuery = `
  query fetchSubtreeCommits($toBlock: Int!) {
    subtreeCommits(block: { number: $toBlock }, orderBy: subtreeIndex, orderDirection: desc, first: 1) {
      newRoot,
      subtreeIndex
    }
  }
`;

export async function fetchLastCommittedMerkleIndex(
  endpoint: string,
  toBlock: number
): Promise<number> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: subtreeCommitQuery,
        variables: {
          toBlock: toBlock,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `Failed to fetch last committed merkle index from subgraph: ${text}`
      );

      throw new Error(
        `Failed to fetch last committed merkle index from subgraph: ${text}`
      );
    }

    const res = (await response.json()) as FetchSubtreeCommitsResponse;

    if (res.data.subtreeCommits.length === 0) {
      return -1;
    } else {
      const subtreeIndices = res.data.subtreeCommits.map((commit) =>
        parseInt(commit.subtreeIndex)
      );
      const maxSubtreeIndex = maxArray(subtreeIndices);

      return (maxSubtreeIndex + 1) * BinaryPoseidonTree.BATCH_SIZE - 1;
    }
  } catch (err) {
    console.error("Error when fetching latest subtree commit from subgraph");
    throw err;
  }
}

interface FetchNullifiersResponse {
  data: {
    nullifiers: NullifierResponse[];
  };
}

interface NullifierResponse {
  nullifier: string;
}

const nullifiersQuery = `
  query fetchNullifiers($fromBlock: Int!, $toBlock: Int!) {
    nullifiers(block: { number: $toBlock, number_gte: $fromBlock}) {
      nullifier
    }
  }
`;

export async function fetchNullifiers(
  endpoint: string,
  fromBlock: number,
  toBlock: number
): Promise<bigint[]> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: nullifiersQuery,
        variables: {
          fromBlock,
          toBlock: toBlock,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Failed to fetch nullifiers from subgraph: ${text}`);

      throw new Error(`Failed to fetch nullifiers from subgraph: ${text}`);
    }

    const res = (await response.json()) as FetchNullifiersResponse;

    return res.data.nullifiers.map(({ nullifier }) => BigInt(nullifier));
  } catch (err) {
    console.error("Error when fetching nullifiers from subgraph");
    throw err;
  }
}
