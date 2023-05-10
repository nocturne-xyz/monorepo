import {
  Note,
  SubgraphUtils,
  EncodedNote,
  NoteTrait,
  StealthAddressTrait,
} from "@nocturne-xyz/sdk";

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
  noteCommitments: string[] | null;
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
query fetchInsertions($fromIdx: Bytes!, $toIdx: Bytes!) {
  treeInsertions(where: { idx_gte: $fromIdx, idx_lt: $toIdx }) {
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

  return res.data.treeInsertions.map((insertion) => {
    if (insertion.note) {
      // TODO: get Y coordinate
      const note = insertion.note;
      const owner = StealthAddressTrait.fromCompressedPoints(
        BigInt(note.ownerH1),
        BigInt(note.ownerH2)
      );
      const encodedNote: EncodedNote = {
        owner,
        nonce: BigInt(note.nonce),
        encodedAssetAddr: BigInt(note.encodedAssetAddr),
        encodedAssetId: BigInt(note.encodedAssetId),
        value: BigInt(note.value),
      };

      return NoteTrait.decode(encodedNote);
    } else if (insertion.noteCommitments) {
      return (insertion.noteCommitments as string[]).map((commitment) =>
        BigInt(commitment)
      );
    } else {
      throw new Error("insertion must contain either note or noteCommitments");
    }
  });
}

const latestSubtreeCommitQuery = `\
  query latestSubtreeCommit {
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
    return -1;
  }

  return parseInt(res.data.subtreeCommits[0].subtreeIndex);
}
