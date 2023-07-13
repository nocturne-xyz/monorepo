import { ethers } from "ethers";

export type Address = string;

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
