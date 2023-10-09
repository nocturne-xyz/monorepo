import { ethers } from "ethers";
import {
  ResetFn,
  RunCommandDetachedOpts,
  runCommandBackground,
  sleep,
} from "./utils";
import { assertOrErr } from "@nocturne-xyz/deploy/dist/src/utils";
import findWorkspaceRoot from "find-yarn-workspace-root";

const ROOT_DIR = findWorkspaceRoot()!;
const E2E_TESTS_DIR = `${ROOT_DIR}/packages/e2e-tests`;

const FORK_NETWORKS = "mainnet";
export type ForkNetwork = typeof FORK_NETWORKS;

const FORK_NETWORK_MAPPING: { [K in ForkNetwork]: string } = {
  mainnet:
    "https://eth-mainnet.g.alchemy.com/v2/X21iuJe_hcEAH4cooxG7xGuTQ-ebJJmB",
};

// returns snapshotId of empty chain state
export async function startHardhat(
  forkNetwork?: ForkNetwork
): Promise<ResetFn> {
  const cmd = "npx";
  const args = ["hardhat", "node", "--hostname", "0.0.0.0"];

  if (forkNetwork) {
    const url = FORK_NETWORK_MAPPING[forkNetwork];
    args.push("--fork", url);
  }

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
