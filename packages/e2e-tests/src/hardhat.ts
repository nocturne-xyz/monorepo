import { ethers } from "ethers";
import {
  ResetFn,
  RunCommandDetachedOpts,
  runCommandBackground,
  sleep,
} from "./utils";
import findWorkspaceRoot from "find-yarn-workspace-root";
import { assertOrErr } from "@nocturne-xyz/core";

const ROOT_DIR = findWorkspaceRoot()!;
const E2E_TESTS_DIR = `${ROOT_DIR}/packages/e2e-tests`;

// returns snapshotId of empty chain state
export async function startHardhat(): Promise<ResetFn> {
  const cmd = "npx";
  const args = ["hardhat", "node", "--hostname", "0.0.0.0"];

  const cmdOpts: RunCommandDetachedOpts = {
    cwd: E2E_TESTS_DIR,
    processName: "hardhat",
    onError: console.error,
  };

  runCommandBackground(cmd, args, cmdOpts);
  await sleep(8_000);

  const provider = new ethers.providers.JsonRpcProvider("http://0.0.0.0:8545");
  // enable interval mining with 500ms block time
  await provider.send("evm_setIntervalMining", [500]);

  // get snapshot with empty chain state
  let snapshotId = await provider.send("evm_snapshot", []);
  return async () => {
    const provider = new ethers.providers.JsonRpcProvider(
      "http://0.0.0.0:8545"
    );

    const success = await provider.send("evm_revert", [snapshotId]);
    assertOrErr(success, "failed to revert to snapshot");

    await sleep(2_000);
    snapshotId = await provider.send("evm_snapshot", []);
  };
}
