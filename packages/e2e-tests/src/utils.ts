import {
  DepositStatusResponse,
  IncludedEncryptedNote,
  IncludedNote,
  NoteTrait,
  OperationStatus,
  SubmittableOperationWithNetworkInfo,
  TreeConstants,
  OperationTrait,
  range,
} from "@nocturne-xyz/core";
import { Mutex } from "async-mutex";
import { spawn } from "child_process";
import * as JSON from "bigint-json-serialization";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { thunk } from "@nocturne-xyz/core";
import { Insertion } from "@nocturne-xyz/persistent-log";
import { fetchTreeInsertions } from "@nocturne-xyz/subgraph-sync-adapters/src/treeInsertions/fetch";
import { SUBGRAPH_URL } from "./deploy";

export const ONE_DAY_SECONDS = 60n * 60n * 24n;

// 10^9 (e.g. 10 gwei if this was eth)
export const GAS_PRICE = 10n * 10n ** 9n;
// 10^9 gas
export const GAS_FAUCET_DEFAULT_AMOUNT = 10_000_000n * GAS_PRICE; // 100M gwei

export const BUNDLER_ENDPOINT = `http://localhost:3000`;

export type TeardownFn = () => Promise<void>;
export type ResetFn = () => Promise<void>;

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  operation: SubmittableOperationWithNetworkInfo
): Promise<OperationStatus> {
  console.log("submitting operation");
  let res: any;
  try {
    res = await fetch(`${BUNDLER_ENDPOINT}/relay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operation }),
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

  const operationDigest = OperationTrait.computeDigest(operation);

  let count = 0;
  while (count < 10) {
    try {
      res = await fetch(`${BUNDLER_ENDPOINT}/operations/${operationDigest}`, {
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
  getRedisServer: () => Promise<RedisMemoryServer>;
  getRedis: () => Promise<IORedis>;
  clearRedis: () => Promise<void>;
}

// HACK specify ports to use up-front to ensure they don't conflict with any of the actors
const redisPorts = range(6000, 6100);
const mutex = new Mutex();
export function makeRedisInstance(): RedisHandle {
  const redisThunk = thunk<[IORedis, RedisMemoryServer]>(async () => {
    const port = await mutex.runExclusive(() => redisPorts.pop());
    if (!port)
      throw new Error("ran out of available ports for redis instances");

    const server = await RedisMemoryServer.create({ instance: { port } });
    const host = await server.getHost();
    return [new IORedis(port, host), server];
  });

  return {
    getRedisServer: async () => (await redisThunk())[1],
    getRedis: async () => (await redisThunk())[0],
    clearRedis: async () => {
      const [redis, _] = await redisThunk();
      redis.flushall();
    },
  };
}

export async function getAllTreeInsertionsFromSubgraph(): Promise<Insertion[]> {
  const treeInsertionEvents = await fetchTreeInsertions(SUBGRAPH_URL, 0n);
  return treeInsertionEvents.flatMap(({ inner: insertion }): Insertion[] => {
    if ("numZeros" in insertion) {
      return range(insertion.numZeros).map((i) => ({
        merkleIndex: insertion.merkleIndex + i,
        noteCommitment: TreeConstants.ZERO_VALUE,
      }));
    } else if (NoteTrait.isEncryptedNote(insertion)) {
      const noteCommitment = (insertion as IncludedEncryptedNote).commitment;
      return [
        {
          merkleIndex: insertion.merkleIndex,
          noteCommitment,
        },
      ];
    } else {
      return [insertion as IncludedNote];
    }
  });
}
