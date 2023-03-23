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

  walletAddress(): Address {
    return this.contracts.walletProxy.proxy;
  }

  handlerAddress(): Address {
    return this.contracts.handlerProxy.proxy;
  }

  depositManagerAddress(): Address {
    return this.contracts.depositManagerProxy.proxy;
  }

  gasAsset(ticker: string): Address | undefined {
    return this.gasAssets.get(ticker);
  }

  rateLimit(ticker: string): RateLimit | undefined {
    return this.rateLimits.get(ticker);
  }
}

export function loadNocturneConfig(
  networkNameOrFilePath: string
): NocturneConfig {
  let json: string;
  if (fs.existsSync(networkNameOrFilePath)) {
    json = fs.readFileSync(networkNameOrFilePath).toString();
  } else {
    json = fs
      .readFileSync(`${CONFIGS_DIR}/${networkNameOrFilePath}.json`)
      .toString();
  }

  const parsed = JSON.parse(json) as NocturneConfig;
  return new NocturneConfig(
    parsed.contracts,
    new Map(Object.entries(parsed.gasAssets)),
    new Map(Object.entries(parsed.rateLimits))
  );
}
