import { RunCommandDetachedOpts, runCommandDetached, sleep } from "./utils";

export interface AnvilNetworkConfig {
  blockTimeSecs?: number;
  gasPrice?: bigint;
}

export async function startAnvil(
  config: AnvilNetworkConfig
): Promise<() => Promise<void>> {
  const { blockTimeSecs, gasPrice } = config ?? {};

  const cmd = "anvil";
  const args = [];

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

  const stop = runCommandDetached(cmd, args, cmdOpts);
  await sleep(5_000);
  return async () => {
    stop();
  };
}
