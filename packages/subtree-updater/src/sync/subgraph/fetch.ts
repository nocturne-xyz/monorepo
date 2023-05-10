import { Note, SubgraphUtils, EncodedNote, NoteTrait } from "@nocturne-xyz/sdk";

const { makeSubgraphQuery, totalEntityIndexFromBlockNumber } = SubgraphUtils;

interface CompressedNoteResponse {
  ownerH1: string;
  ownerH2: string;
  nonce: string;
  encodedAssetAddr: string;
  encodedAssetId: string;
  value: string;
}

interface InsertionResponse {
  note: CompressedNoteResponse | null;
  encryptedNote: string[] | null;
}

interface FetchInsertionsResponse {
  data: {
    treeInsertions: InsertionResponse[];
  };
}

interface FetchInsertionsVars {
  fromIdx: string;
  toIdx: string;
}

const insertionsQuery = `\
query fetchNotes($fromIdx: Bytes!, $toIdx: Bytes!) {
  treeInsertions(where: { idx_gte: $fromIdx, idx_lt: $toIdx}) {
    note {
      ownerH1
      ownerH2
      nonce
      encodedAssetAddr
      encodedAssetId
      value
    }
    noteCommitments
  }
}`;

// gets note or note commitments for the given merkle index range, up to `toBlock`
// the range is inclusive - i.e. [fromBlock, toBlock]
export async function fetchInsertions(
  endpoint: string,
  fromBlock: number,
  toBlock: number
): Promise<(Note | bigint[])[]> {
  const query = makeSubgraphQuery<FetchInsertionsVars, FetchInsertionsResponse>(
    endpoint,
    insertionsQuery,
    "treeInsertions"
  );

  const fromIdx = totalEntityIndexFromBlockNumber(BigInt(fromBlock)).toString();
  const toIdx = totalEntityIndexFromBlockNumber(BigInt(toBlock + 1)).toString();
  const res = await query({ fromIdx, toIdx });

  if (res.data.note) {
    // TODO: get Y coordinate
    const encodedNote: EncodedNote = {
      owner: {
        h1X: BigInt(res.data.note.ownerH1),
        h1Y: 0n,
        h2X: BigInt(res.data.note.ownerH2),
        h2Y: 0n,
      },
      nonce: BigInt(res.data.note.nonce),
      encodedAssetAddr: BigInt(res.data.note.encodedAssetAddr),
      encodedAssetId: BigInt(res.data.note.encodedAssetId),
      value: BigInt(res.data.note.value),
    };

    return NoteTrait.decode(encodedNote);
  } else if (res.data.noteCommitments) {
    return (res.data.noteCommitments as string[]).map((commitment) =>
      BigInt(commitment)
    );
  } else {
    throw new Error("res must contain either note or noteCommitments");
  }
}

const latestSubtreeCommitQuery = `\
  query latestSubtreeCommit() {
    subtreeCommits(orderBy: subtreeIndex, orderDirection: desc, first: 1) {
      subtreeIndex
    }
  }
`;

interface LatestSubtreeCommitResponse {
  data: {
    subtreeCommits: SubtreeCommitResponse[];
  };
}

interface SubtreeCommitResponse {
  subtreeIndex: string;
}

export async function fetchLatestSubtreeCommit(
  endpoint: string
): Promise<number> {
  const query = makeSubgraphQuery<undefined, LatestSubtreeCommitResponse>(
    endpoint,
    latestSubtreeCommitQuery,
    "latestSubtreeCommit"
  );

  const res = await query(undefined);
  if (res.data.subtreeCommits.length === 0) {
    throw new Error("no subtree commits found");
  }
  return parseInt(res.data.subtreeCommits[0].subtreeIndex);
}
