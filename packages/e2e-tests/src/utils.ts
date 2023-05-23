import {
  DepositStatusResponse,
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
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { thunk } from "@nocturne-xyz/sdk";

const ROOT_DIR = findWorkspaceRoot()!;
const EXECUTABLE_CMD = `${ROOT_DIR}/rapidsnark/build/prover`;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_js/subtreeupdate.wasm`;
const WITNESS_GEN_EXECUTABLE_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;
const TMP_PATH = `${ARTIFACTS_DIR}/subtreeupdate/`;
const VKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/vkey.json`;

const MOCK_SUBTREE_UPDATER_DELAY = 2100;

export type TeardownFn = () => Promise<void>;
export type ResetFn = () => Promise<void>;

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

export async function queryDepositStatus(
  depositHash: string
): Promise<DepositStatusResponse | undefined> {
  console.log(`query deposit status for ${depositHash}`);

  try {
    const res = await fetch(`http://localhost:3001/status/${depositHash}`, {
      method: "GET",
    });
    return (await res.json()) as DepositStatusResponse;
  } catch (err) {
    console.error("error getting deposit status: ", err);
  }
}

export async function submitAndProcessOperation(
  op: ProvenOperation
): Promise<OperationStatus> {
  console.log("submitting operation");
  let res: any;
  try {
    res = await fetch(`http://localhost:3000/relay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operation: op }),
    });
    const resJson = await res.json();
    console.log("bundler server response: ", resJson);

    if (!res.ok) {
      throw new Error(resJson);
    }
  } catch (err) {
    console.log("error submitting operation: ", err);
    throw err;
  }

  console.log("waiting for bundler to receive the operation");
  await sleep(5_000);

  const operationDigest = computeOperationDigest(op);

  let count = 0;
  while (count < 10) {
    try {
      res = await fetch(`http://localhost:3000/operations/${operationDigest}`, {
        method: "GET",
      });
      const statusRes = await res.json();
      const status = statusRes.status as OperationStatus;
      console.log(`bundler marked operation ${operationDigest} ${status}`);

      if (
        status === OperationStatus.EXECUTED_SUCCESS ||
        status === OperationStatus.OPERATION_PROCESSING_FAILED ||
        status === OperationStatus.OPERATION_EXECUTION_FAILED ||
        status === OperationStatus.BUNDLE_REVERTED
      ) {
        return status;
      }
    } catch (err) {
      console.log("error getting operation status: ", err);
      throw err;
    }

    await sleep(5_000);
    count++;
  }

  // if we get here, operation timed out
  console.error("operation timed out after 50 seconds");
  throw new Error("operation timed out after 50 seconds");
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

    // kill child if parent exits first
    process.on("exit", () => {
      child.kill();
    });
  });
}

export interface RunCommandDetachedOpts {
  cwd?: string;
  processName?: string;
  onStdOut?: (data: string) => void;
  onStdErr?: (data: string) => void;
  onError?: (stderr: string) => void;
  onExit?: (
    stdout: string,
    stderr: string,
    code: number | null,
    signal: NodeJS.Signals | null
  ) => void;
}

// runs a command in the child process without waiting for completion
// instead, returns a teardown function that can be used to kill the process
// NOTE: there is a potential race condition when killing the process:
//   if the process has already exited and the OS re-allocated the PID,
//   then the teardown function may attempt to kill that other process.
export function runCommandBackground(
  cmd: string,
  args: string[],
  opts?: RunCommandDetachedOpts
) {
  const { cwd, onStdOut, onStdErr, onError, onExit, processName } = opts ?? {};
  const child = spawn(cmd, args, { cwd });
  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (data) => {
    const output = data.toString();
    stdout += output;

    if (onStdOut) {
      onStdOut(output);
    }
  });

  child.stderr.on("data", (data) => {
    const output = data.toString();
    stderr += output;

    if (onStdErr) {
      onStdErr(output);
    }
  });

  child.on("error", () => {
    if (onError) {
      onError(stderr);
    } else {
      console.error(stderr);
    }
  });

  child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
    if (onExit) {
      onExit(stdout, stderr, code, signal);
    } else {
      let msg = "";
      if (processName) {
        msg += `${processName} (${child.pid}) exited`;
      } else {
        msg += `child process ${child.pid} exited`;
      }

      if (code) {
        msg += ` with code ${code}`;
      }
      if (signal) {
        msg += ` on signal ${signal}`;
      }

      console.log(msg);

      if (stderr) {
        console.log("STDERR:");
        console.log(stderr);
      }
    }
  });

  // kill child if parent exits first
  process.on("exit", () => {
    child.kill();
  });
}

interface RedisHandle {
  getRedis: () => Promise<IORedis>;
  clearRedis: () => Promise<void>;
}

export function makeRedisInstance(): RedisHandle {
  const redisThunk = thunk(async () => {
    const server = await RedisMemoryServer.create();
    const host = await server.getHost();
    const port = await server.getPort();
    return new IORedis(port, host);
  });

  return {
    getRedis: async () => await redisThunk(),
    clearRedis: async () => {
      const redis = await redisThunk();
      redis.flushall();
    },
  };
}
