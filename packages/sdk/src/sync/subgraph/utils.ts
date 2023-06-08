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
        console.error(`failed to query ${dataLabel} from subgraph: ${text}`);

        throw new Error(`failed to query ${dataLabel} from subgraph: ${text}`);
      }

      return (await response.json()) as U;
    } catch (err) {
      console.error(`error when querying ${dataLabel} from subgraph`);
      throw err;
    }
  };
