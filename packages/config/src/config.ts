import { NocturneContractDeployment } from "./deployment";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";

const CONFIGS_DIR = `${__dirname}/../configs`;

export interface RateLimit {
  perAddress: bigint;
  global: bigint;
}

export interface NocturneConfig {
  contracts: NocturneContractDeployment;
  gasAssets: Map<string, string>; // ticker -> address
  rateLimits: Map<string, RateLimit>; // ticker -> rate limit
}

export function loadNocturneConfig(network: string): NocturneConfig {
  const json = fs.readFileSync(`${CONFIGS_DIR}/${network}.json`).toString();
  const parsed = JSON.parse(json);
  return {
    contracts: parsed.contracts,
    gasAssets: new Map(Object.entries(parsed.gasAssets)),
    rateLimits: new Map(Object.entries(parsed.rateLimits)),
  };
}
