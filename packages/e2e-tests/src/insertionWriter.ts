import {
  InsertionWriter,
  SubgraphTreeInsertionSyncAdapter,
} from "@nocturne-xyz/insertion-writer";
import { getInsertionLogRedis } from "./subtreeUpdater";
import { makeTestLogger } from "@nocturne-xyz/offchain-utils";

export interface InsertionWriterConfig {
  subgraphUrl: string;
}

export async function startInsertionWriter(
  config: SubtreeUpdaterConfig
): Promise<() => Promise<void>> {
  const logger = makeTestLogger("insertion-writer", "insertion-writer");
  const syncAdapter = new SubgraphTreeInsertionSyncAdapter(
    config.subgraphUrl,
    logger
  );
  const insertionWriter = new InsertionWriter(
    syncAdapter,
    await getInsertionLogRedis(),
    logger
  );

  const { promise, teardown } = await insertionWriter.start();

  return async () => {
    await teardown();
    await promise;
  };
}
