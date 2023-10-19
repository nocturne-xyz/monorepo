import { spawn } from "child_process";
import { ethers } from "ethers";

import { Address } from "@nocturne-xyz/core";

export async function execAsync(command: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, { shell: true, stdio: "inherit" });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command "${command}" exited with code ${code}`));
      }
    });
  });
}

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
