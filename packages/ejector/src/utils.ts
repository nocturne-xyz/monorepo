import { spawn } from "child_process";

export type TeardownFn = () => Promise<void>;
export type ResetFn = () => Promise<void>;

export const ROOT_DIR = `${__dirname}/../..`;
export const ARTIFACTS_DIR = `${ROOT_DIR}/artifacts`;

export const SUBGRAPH_URL = "http://localhost:8000/subgraphs/name/nocturne";

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

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
