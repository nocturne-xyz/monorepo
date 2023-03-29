import { ethers } from "ethers";
import { RunCommandDetachedOpts, runCommandBackground, sleep } from "./utils";

export interface AnvilNetworkConfig {
  blockTimeSecs?: number;
  gasPrice?: bigint;
}

// returns snapshotId of empty chain state
export async function startAnvil(
  config: AnvilNetworkConfig
): Promise<() => Promise<void>> {
  const { blockTimeSecs, gasPrice } = config ?? {};

  const cmd = "anvil";
  const args = ["--host", "0.0.0.0"];

  if (blockTimeSecs) {
    args.push("--block-time", blockTimeSecs.toString());
  }

  if (gasPrice) {
    args.push("--gas-price", gasPrice.toString());
  }

  const cmdOpts: RunCommandDetachedOpts = {
    processName: "anvil",
    onError: console.error,
  };

  runCommandBackground(cmd, args, cmdOpts);
  await sleep(1_000);

  const provider = new ethers.providers.JsonRpcProvider("http://0.0.0.0:8545");
  // get snapshot with empty chain state
  const snapshotId = await provider.send("evm_snapshot", []);
  return async () => {
    const provider = new ethers.providers.JsonRpcProvider("http://0.0.0.0:8545");
    await provider.send("evm_revert", [snapshotId]);
  }
}
