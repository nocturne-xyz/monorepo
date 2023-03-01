import { NocturneDeploymentConfig } from "@nocturne-xyz/deploy";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";

const CONFIGS_DIR = `${__dirname}/../configs`;

export interface RateLimit {
  perAddress: bigint;
  global: bigint;
}

// TODO: config exports NocturneDeploymentConfig not other way around
export interface NocturneConfig {
  contracts: NocturneDeploymentConfig;
  gasAssets: Map<string, string>; // ticker -> address
  rateLimits: Map<string, RateLimit>; // ticker -> rate limit
}

export function loadNocturneConfig(network: string): NocturneConfig {
  const config = fs.readFileSync(`${CONFIGS_DIR}/${network}.json`).toString();
  return JSON.parse(config) as NocturneConfig;
}
