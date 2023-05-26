import {
  Note,
  SubgraphUtils,
  EncodedNote,
  NoteTrait,
  StealthAddressTrait,
  assertOrErr,
  TreeConstants,
} from "@nocturne-xyz/sdk";

const { BATCH_SIZE } = TreeConstants;

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
  notes: CompressedNoteResponse[] | null;
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
    notes {
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

// gets notes or note commitments for the given merkle index range, up to `toBlock`
// the range is inclusive - i.e. [fromBlock, toBlock]
export async function fetchInsertionBatches(
  endpoint: string,
  fromBlock: number,
  toBlock: number
): Promise<(Note[] | bigint[])[]> {
  const query = makeSubgraphQuery<FetchInsertionsVars, FetchInsertionsResponse>(
    endpoint,
    insertionsQuery,
    "treeInsertions"
  );

  const fromIdx = totalEntityIndexFromBlockNumber(BigInt(fromBlock)).toString();
  const toIdx = totalEntityIndexFromBlockNumber(BigInt(toBlock + 1)).toString();
  const res = await query({ fromIdx, toIdx });

  return res.data.treeInsertions.map((insertion) => {
    console.log(insertion);
    if (insertion.notes && insertion.notes.length > 0) {
      return insertion.notes.map((note) => {
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
      });
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
    subtreeCommits(orderBy: subtreeBatchOffset, orderDirection: desc, first: 1) {
      subtreeBatchOffset
    }
  }
`;

interface LatestSubtreeCommitResponse {
  data: {
    subtreeCommits: SubtreeCommitResponse[];
  };
}

interface SubtreeCommitResponse {
  subtreeBatchOffset: string;
}

export async function fetchLatestCommittedSubtreeIndex(
  endpoint: string
): Promise<number> {
  const query = makeSubgraphQuery<undefined, LatestSubtreeCommitResponse>(
    endpoint,
    latestSubtreeCommitQuery,
    "latestSubtreeCommit"
  );

  // fetch the latest subtree commit entity by ordering by subtree index, sorting in descending order, and asking API for only the first result
  const res = await query(undefined);
  if (res.data.subtreeCommits.length === 0) {
    return -1;
  }

  const subtreeBatchOffset = parseInt(
    res.data.subtreeCommits[0].subtreeBatchOffset
  );
  assertOrErr(
    subtreeBatchOffset % BATCH_SIZE === 0,
    `received invalid leftmost leaf index from subgraph: ${res.data.subtreeCommits[0].subtreeBatchOffset}`
  );
  return subtreeBatchOffset / BATCH_SIZE;
}
