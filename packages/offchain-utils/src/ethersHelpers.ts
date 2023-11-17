import { ethers } from "ethers";
import { intFromEnv } from "./configuration";

const DEFAULT_RPC_TIMEOUT_MS = 3000;
/**
 * Get ethers provider and signer from environment variables.
 */
export function getEthersProviderFromEnv(): ethers.providers.JsonRpcProvider {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error("RPC_URL env var not set");
  }
  const timeout = intFromEnv("RPC_TIMEOUT_MS") ?? DEFAULT_RPC_TIMEOUT_MS;
  return new ethers.providers.JsonRpcProvider({
    url: rpcUrl,
    timeout,
  });
}
