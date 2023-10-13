import { InsertionWriter } from "@nocturne-xyz/insertion-writer";
import { SubgraphTreeInsertionSyncAdapter } from "@nocturne-xyz/subgraph-sync-adapters";
import { getInsertionLogRedisClient } from "./subtreeUpdater";
import { makeTestLogger } from "@nocturne-xyz/offchain-utils";

export interface InsertionWriterConfig {
  subgraphUrl: string;
}

export async function startInsertionWriter(
  config: InsertionWriterConfig
): Promise<() => Promise<void>> {
  const logger = makeTestLogger("insertion-writer", "insertion-writer");
  const syncAdapter = new SubgraphTreeInsertionSyncAdapter(
    config.subgraphUrl,
    logger
  );
  const client = await getInsertionLogRedisClient();
  const insertionWriter = new InsertionWriter(syncAdapter, client, logger);

  const { promise, teardown } = await insertionWriter.start({
    throttleOnEmptyMs: 3000,
  });

  return async () => {
    await teardown();
    await promise;
  };
}
