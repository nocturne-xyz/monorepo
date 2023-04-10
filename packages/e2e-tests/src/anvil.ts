import { ethers } from "ethers";
import {
  ResetFn,
  RunCommandDetachedOpts,
  runCommandBackground,
  sleep,
} from "./utils";
import { assertOrErr } from "@nocturne-xyz/deploy/dist/src/utils";

// returns snapshotId of empty chain state
export async function startAnvil(): Promise<ResetFn> {
  const cmd = "anvil";
  const args = ["--block-time", "1", "--host", "0.0.0.0", "--chain-id", "1337"];

  const cmdOpts: RunCommandDetachedOpts = {
    processName: "anvil",
    onError: console.error,
  };

  runCommandBackground(cmd, args, cmdOpts);
  await sleep(1_000);

  const provider = new ethers.providers.JsonRpcProvider("http://0.0.0.0:8545");
  // get snapshot with empty chain state
  let snapshotId = await provider.send("evm_snapshot", []);
  return async () => {
    const provider = new ethers.providers.JsonRpcProvider(
      "http://0.0.0.0:8545"
    );

    const success = await provider.send("evm_revert", [snapshotId]);
    assertOrErr(success, "failed to revert to snapshot");

    await sleep(1_000);
    snapshotId = await provider.send("evm_snapshot", []);
  };
}
