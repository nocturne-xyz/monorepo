import retry from "async-retry";
import { zip } from "../../utils";
import { TreeFrontier } from "../../primitives";

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

const treeFrontierQuery = `
{
  treeFrontier(id: "TREE_FRONTIER") {
    merkleIndex
    root,
    latestTotalEntityIndex
    rightmostPath0
    rightmostPath1
    rightmostPath2
    rightmostPath3
  }
}
`;

interface TreeFrontierResponse {
  data: {
    merkleIndex: string;
    root: string;
    latestTotalEntityIndex: string;
    rightmostPath0: string[];
    rightmostPath1: string[];
    rightmostPath2: string[];
    rightmostPath3: string[];
  };
}

export async function fetchTreeFrontier(
  endpoint: string
): Promise<TreeFrontier> {
  const query = makeSubgraphQuery<undefined, TreeFrontierResponse>(
    endpoint,
    treeFrontierQuery,
    "tree frontier"
  );
  const res = await query(undefined);
  if (!res.data) {
    throw new Error(
      "received empty response from subgraph when fetching tree frontier"
    );
  }

  const merkleIndex = parseInt(res.data.merkleIndex);
  const root = BigInt(res.data.root);
  const latestTotalEntityIndex = BigInt(res.data.latestTotalEntityIndex);
  const rightmostPath = zip(
    zip(res.data.rightmostPath0, res.data.rightmostPath2),
    zip(res.data.rightmostPath1, res.data.rightmostPath3)
  ).map(([left, right]) => [...left, ...right].map((hash) => BigInt(hash)));

  return {
    merkleIndex,
    root,
    latestTotalEntityIndex,
    rightmostPath,
  };
}

export const makeSubgraphQuery =
  <T, U>(endpoint: string, query: string, dataLabel: string) =>
  async (variables: T): Promise<U> => {
    return await retry(
      async (bail) => {
        try {
          // if anything throws, we retry
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
            console.error(
              `failed to query ${dataLabel} from subgraph: ${text}`
            );

            const err = Error(
              `failed to query ${dataLabel} from subgraph: ${text}`
            );
            if (response.status === 400) {
              bail(err);
            } else {
              throw err;
            }
          }

          return (await response.json()) as U;
        } catch (err) {
          console.error(`could not query ${dataLabel} from subgraph`);
          throw err;
        }
      },
      {
        retries: 5,
      }
    );
  };
