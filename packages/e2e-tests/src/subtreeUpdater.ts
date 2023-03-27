import { sleep } from "./utils";
import { SubtreeUpdateServer } from "@nocturne-xyz/subtree-updater";
import { MockSubtreeUpdateProver } from "@nocturne-xyz/sdk";
import { ethers } from "ethers";

export interface SubtreeUpdaterConfig {
  handlerAddress: string;
  rpcUrl: string;
  txSignerKey: string;
  interval?: number
}

export async function startSubtreeUpdater(
  config: SubtreeUpdaterConfig
): Promise<() => Promise<void>> {
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(config.txSignerKey, provider);
  const updater = new SubtreeUpdateServer(
    new MockSubtreeUpdateProver(),
    config.handlerAddress,
    "./db",
    signer,
    {
      fillBatches: true,
      interval: config.interval ?? 8_000,
    }
  );

  await updater.init();
  updater.start();

  await sleep(5_000);

  return async () => {
    await updater.stop();
    await updater.dropDB();
  }
}
