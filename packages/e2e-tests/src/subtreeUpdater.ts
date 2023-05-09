import { SubtreeUpdater } from "@nocturne-xyz/subtree-updater";
import { MockSubtreeUpdateProver } from "@nocturne-xyz/sdk";
import { ethers } from "ethers";
import { makeTestLogger } from "@nocturne-xyz/offchain-utils";
import { Handler__factory } from "@nocturne-xyz/contracts";
import { SubgraphSubtreeUpdaterSyncAdapter } from "@nocturne-xyz/subtree-updater/src/sync/subgraph/adapter";
import { makeRedisInstance } from "./utils";

export interface SubtreeUpdaterConfig {
  handlerAddress: string;
  rpcUrl: string;
  subgraphUrl: string;
  txSignerKey: string;
  fillBatchLatency?: number;
}

const { getRedis, clearRedis } = makeRedisInstance();

export async function startSubtreeUpdater(
  config: SubtreeUpdaterConfig
): Promise<() => Promise<void>> {
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(config.txSignerKey, provider);
  const logger = makeTestLogger("subtree-updater", "subtree-updater");
  const handlerContract = Handler__factory.connect(
    config.handlerAddress,
    signer
  );
  const syncAdapter = new SubgraphSubtreeUpdaterSyncAdapter(config.subgraphUrl);
  const updater = new SubtreeUpdater(
    handlerContract,
    syncAdapter,
    logger,
    await getRedis(),
    new MockSubtreeUpdateProver(),
    {
      fillBatchLatency: config.fillBatchLatency,
    }
  );

  const { promise, teardown } = updater.start();

  return async () => {
    await teardown();
    await promise;
    await clearRedis();
  };
}
