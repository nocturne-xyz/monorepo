import { exec } from "child_process";
import { ethers } from "ethers";
import { promisify } from "util";

import { Address } from "@nocturne-xyz/core";

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

export function protocolWhitelistKey(
  contractAddress: Address,
  selector: string
): string {
  const result: bigint =
    (BigInt(contractAddress) << BigInt(32)) | BigInt(selector);
  return "0x" + result.toString(16).padStart(24, "0");
}
