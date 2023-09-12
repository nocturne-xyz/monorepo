import {
  InsertionWriter,
  SubgraphTreeInsertionSyncAdapter,
} from "@nocturne-xyz/insertion-writer";
import { getInsertionLogRedisServer } from "./subtreeUpdater";
import { makeTestLogger } from "@nocturne-xyz/offchain-utils";
import IORedis from "ioredis";

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
  const server = await getInsertionLogRedisServer();
  const client = new IORedis(await server.getPort(), await server.getHost());
  const insertionWriter = new InsertionWriter(syncAdapter, client, logger);

  const { promise, teardown } = await insertionWriter.start();

  return async () => {
    await teardown();
    await promise;
  };
}
