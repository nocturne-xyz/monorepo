import { exec } from "child_process";
import { ethers } from "ethers";
import { promisify } from "util";

export type Address = string;

export const execAsync = promisify(exec);

export function assertOrErr(condition: boolean, error?: string): void {
  if (!condition) {
    throw new Error(error);
  }
}

export function getSelector(signature: string): string {
  const sigBytes = ethers.utils.toUtf8Bytes(signature);
  const hash = ethers.utils.keccak256(sigBytes);
  return ethers.utils.hexDataSlice(hash, 0, 4);
}
