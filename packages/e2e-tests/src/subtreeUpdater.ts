import { SubtreeUpdateServer } from "@nocturne-xyz/subtree-updater";
import { MockSubtreeUpdateProver } from "@nocturne-xyz/sdk";
import { ethers } from "ethers";
import { makeTestLogger } from "@nocturne-xyz/offchain-utils";

export interface SubtreeUpdaterConfig {
  handlerAddress: string;
  rpcUrl: string;
  txSignerKey: string;
  interval?: number;
}

export async function startSubtreeUpdater(
  config: SubtreeUpdaterConfig
): Promise<() => Promise<void>> {
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(config.txSignerKey, provider);
  const logger = makeTestLogger("subtree-updater", "server");
  const updater = new SubtreeUpdateServer(
    new MockSubtreeUpdateProver(),
    config.handlerAddress,
    "./db",
    signer,
    logger,
    {
      fillBatches: true,
      interval: config.interval ?? 4_000,
    }
  );

  await updater.init();
  updater.start();

  return async () => {
    await updater.stop();
    await updater.dropDB();
  };
}
