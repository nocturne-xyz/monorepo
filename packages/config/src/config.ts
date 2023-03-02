import { Address, NocturneContractDeployment } from "./deployment";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";

const CONFIGS_DIR = `${__dirname}/../configs`;

export interface RateLimit {
  perAddress: bigint;
  global: bigint;
}

export class NocturneConfig {
  contracts: NocturneContractDeployment;
  gasAssets: Map<string, string>; // ticker -> address
  rateLimits: Map<string, RateLimit>; // ticker -> rate limit

  constructor(
    contracts: NocturneContractDeployment,
    gasAssets: Map<string, string>,
    rateLimits: Map<string, RateLimit>
  ) {
    this.contracts = contracts;
    this.gasAssets = gasAssets;
    this.rateLimits = rateLimits;
  }

  get wallet(): Address {
    return this.contracts.walletProxy.proxy;
  }

  get vault(): Address {
    return this.contracts.vaultProxy.proxy;
  }

  gasAsset(ticker: string): Address | undefined {
    return this.gasAssets.get(ticker);
  }

  rateLimit(ticker: string): RateLimit | undefined {
    return this.rateLimits.get(ticker);
  }
}

export function loadNocturneConfig(network: string): NocturneConfig {
  const json = fs.readFileSync(`${CONFIGS_DIR}/${network}.json`).toString();
  const parsed = JSON.parse(json);
  return new NocturneConfig(
    parsed.contracts,
    new Map(Object.entries(parsed.gasAssets)),
    new Map(Object.entries(parsed.rateLimits))
  );
}
