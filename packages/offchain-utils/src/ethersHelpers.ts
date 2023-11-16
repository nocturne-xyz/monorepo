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

// TODO: REMOVE ALL THIS
import {
  DefenderRelayProvider,
  DefenderRelaySigner,
} from "@openzeppelin/defender-relay-client/lib/ethers";
import { Speed } from "@openzeppelin/defender-relay-client";
import * as https from "https";

const DEFAULT_SPEED: Speed = "safeLow";

/**
 * Get ethers provider and signer from environment variables.
 */
export function getEthersProviderAndSignerFromEnvConfiguration(): {
  provider: ethers.providers.JsonRpcProvider;
  signer: ethers.Signer;
} {
  const relayerApiKey = process.env.OZ_RELAYER_API_KEY;
  const relayerApiSecret = process.env.OZ_RELAYER_API_SECRET;
  const relayerSpeed = process.env.OZ_RELAYER_SPEED;

  const privateKey = process.env.TX_SIGNER_KEY;
  const rpcUrl = process.env.RPC_URL;

  const timeout = intFromEnv("RPC_TIMEOUT_MS") ?? DEFAULT_RPC_TIMEOUT_MS;

  let signer: ethers.Signer;
  let provider: ethers.providers.JsonRpcProvider;

  if (relayerApiKey && relayerApiSecret) {
    const credentials = {
      apiKey: relayerApiKey,
      apiSecret: relayerApiSecret,
    };
    if (rpcUrl) {
      provider = new ethers.providers.JsonRpcProvider({
        url: rpcUrl,
        timeout: timeout,
      });
    } else {
      provider = new DefenderRelayProvider({
        ...credentials,
        httpsAgent: new https.Agent({
          timeout: timeout,
          keepAlive: true,
        }),
      });
    }
    signer = new DefenderRelaySigner(credentials, provider, {
      speed: (relayerSpeed as Speed) ?? DEFAULT_SPEED,
    });
  } else if (rpcUrl && privateKey) {
    provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    signer = new ethers.Wallet(privateKey, provider);
  } else {
    throw new Error(
      "missing RPC_URL/PRIVATE_KEY or OZ_RELAYER_API_KEY/OZ_RELAYER_API_SECRET"
    );
  }

  return { provider, signer };
}
