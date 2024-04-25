import * as dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

export interface EnvVars {
  RPC_URL: string;
  SPEND_PRIVATE_KEY: string;
  WITHDRAWAL_EOA_PRIVATE_KEY: string;
}

export function getEnvVars(): EnvVars {
  const RPC_URL = process.env.RPC_URL;
  if (!RPC_URL) {
    throw new Error("RPC_URL env var is not set!");
  }

  const SPEND_PRIVATE_KEY = process.env.SPEND_PRIVATE_KEY;
  if (!SPEND_PRIVATE_KEY) {
    throw new Error("SPEND_PRIVATE_KEY env var is not set!");
  }

  const WITHDRAWAL_EOA_PRIVATE_KEY = process.env.WITHDRAWAL_EOA_PRIVATE_KEY;
  if (!WITHDRAWAL_EOA_PRIVATE_KEY) {
    throw new Error("WITHDRAWAL_EOA_PRIVATE_KEY env var is not set!");
  }
  if (!ethers.utils.isHexString(WITHDRAWAL_EOA_PRIVATE_KEY)) {
    throw new Error(
      "WITHDRAWAL_EOA_PRIVATE_KEY env var is not a valid hex string!"
    );
  }

  return {
    RPC_URL,
    SPEND_PRIVATE_KEY,
    WITHDRAWAL_EOA_PRIVATE_KEY,
  };
}
