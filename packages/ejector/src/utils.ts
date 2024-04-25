import { promisify } from "node:util";
import { exec } from "node:child_process";

const execAsync = promisify(exec);

export type TeardownFn = () => Promise<void>;
export type ResetFn = () => Promise<void>;

export const ROOT_DIR = `${__dirname}/..`;
export const ARTIFACTS_DIR = `${ROOT_DIR}/artifacts`;

export const SUBGRAPH_URL = "http://localhost:8000/subgraphs/name/nocturne";

export async function runCommand(
  cmd: string,
  cwd?: string
): Promise<[string, string]> {
  const { stdout, stderr } = await execAsync(cmd, { cwd, env: process.env });
  const out = stdout?.toString() ?? "";
  const err = stderr?.toString() ?? "";
  console.log(out);
  if (err) {
    console.error(err);
  }

  return [out, err];
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
