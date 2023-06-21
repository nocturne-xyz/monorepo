import retry from "async-retry";

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
