import { RunCommandDetachedOpts, runCommandDetached, sleep } from "./utils";

export interface AnvilNetworkConfig {
  blockTimeSecs?: number;
  gasPrice?: bigint;
  streamStdOut?: boolean;
}

export function startAnvil(config: AnvilNetworkConfig): () => Promise<void> {
  const { blockTimeSecs, gasPrice, streamStdOut } = config ?? {};

  let cmd = "anvil";

  if (blockTimeSecs) {
    cmd += ` --block-time ${blockTimeSecs}`;
  }

  if (gasPrice) {
    cmd += `--gas-price ${gasPrice.toString()}`;
  }

  const cmdOpts: RunCommandDetachedOpts = {
    processName: "anvil",
  };

  if (streamStdOut) {
    cmdOpts.onStdOut = (out: string) => {
      console.log(out);
    };
  }

  const inner = runCommandDetached(cmd, cmdOpts);
  return async () => {
    inner();
    // wait 100ms or so to ensure it stops and unbinds from port
    await sleep(100);
  };
}
