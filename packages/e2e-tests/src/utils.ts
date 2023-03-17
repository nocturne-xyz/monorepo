import {
  MockSubtreeUpdateProver,
  OperationStatus,
  ProvenOperation,
  SubtreeUpdateProver,
  computeOperationDigest,
} from "@nocturne-xyz/sdk";
import { spawn } from "child_process";
import { RapidsnarkSubtreeUpdateProver } from "@nocturne-xyz/subtree-updater";
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";
import { WasmSubtreeUpdateProver } from "@nocturne-xyz/local-prover";

const ROOT_DIR = findWorkspaceRoot()!;
const EXECUTABLE_CMD = `${ROOT_DIR}/rapidsnark/build/prover`;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_js/subtreeupdate.wasm`;
const WITNESS_GEN_EXECUTABLE_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;
const TMP_PATH = `${ARTIFACTS_DIR}/subtreeupdate/`;
const VKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/vkey.json`;

const MOCK_SUBTREE_UPDATER_DELAY = 2100;

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getSubtreeUpdateProver(): SubtreeUpdateProver {
  if (
    process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true" &&
    process.env.USE_RAPIDSNARK === "true"
  ) {
    return new RapidsnarkSubtreeUpdateProver(
      EXECUTABLE_CMD,
      WITNESS_GEN_EXECUTABLE_PATH,
      ZKEY_PATH,
      VKEY_PATH,
      TMP_PATH
    );
  } else if (process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true") {
    const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH).toString());
    return new WasmSubtreeUpdateProver(WASM_PATH, ZKEY_PATH, VKEY);
  }

  return new MockSubtreeUpdateProver();
}

export function getSubtreeUpdaterDelay(): number {
  if (
    process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true" &&
    process.env.USE_RAPIDSNARK === "true"
  ) {
    return MOCK_SUBTREE_UPDATER_DELAY + 8000;
  } else if (process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true") {
    return MOCK_SUBTREE_UPDATER_DELAY + 60000;
  }

  return MOCK_SUBTREE_UPDATER_DELAY;
}

export async function submitAndProcessOperation(
  op: ProvenOperation
): Promise<void> {
  console.log("submitting operation");
  let res: any;
  try {
    res = await fetch(`http://localhost:3000/relay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(op),
    });
  } catch (err) {
    console.log("Error submitting operation: ", err);
    throw err;
  }

  console.log("Bundler server response: ", await res.json());

  console.log("waiting for bundler to receive the operation");
  await sleep(5_000);

  const operationDigest = computeOperationDigest(op);

  let executed = false;
  let count = 0;
  while (!executed && count < 10) {
    try {
      res = await fetch(`http://localhost:3000/operations/${operationDigest}`, {
        method: "GET",
      });
      const statusRes = await res.json();
      const status = statusRes.status as OperationStatus;
      console.log(`Bundler marked operation ${operationDigest} ${status}`);
      if (
        status === OperationStatus.EXECUTED_FAILED ||
        status === OperationStatus.EXECUTED_SUCCESS
      ) {
        executed = true;
      }
    } catch (err) {
      console.log("Error getting operation status: ", err);
      throw err;
    }

    await sleep(5_000);
    count++;
  }

  if (!executed) {
    console.error("operation timed out after 50 seconds");
    throw new Error("operation timed out after 50 seconds");
  }
}

export async function runCommand(
  cmd: string,
  cwd?: string
): Promise<[string, string]> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn("sh", ["-c", cmd], { cwd, env: process.env });
    child.stdout.on("data", (data) => {
      const output = data.toString();
      stdout += output;
    });
    child.stderr.on("data", (data) => {
      const output = data.toString();
      stderr += output;
    });
    child.on("error", () => {
      console.error(stderr);
      reject(stderr);
    });
    child.on("exit", () => {
      console.log(stdout);
      resolve([stdout, stderr]);
    });
  });
}
