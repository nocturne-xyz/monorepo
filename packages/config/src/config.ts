import { Address, NocturneContractDeployment } from "./deployment";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";

const CONFIGS_DIR = `${__dirname}/../configs`;

export interface RateLimit {
  perAddress: bigint;
  global: bigint;
}

export interface ProtocolWhitelistEntry {
  contractAddress: Address;
  functionSignatures: string[];
}

export type ProtocolAllowlist = Map<string, ProtocolWhitelistEntry>;

export interface NocturneConfigProperties {
  contracts: NocturneContractDeployment;
  protocolAllowlist: [string, ProtocolWhitelistEntry][]; // name -> entry
  gasAssets: [string, string][]; // ticker -> address
  rateLimits: [string, RateLimit][]; // ticker -> rate limit
}

export class NocturneConfig {
  contracts: NocturneContractDeployment;
  gasAssets: Map<string, string>; // ticker -> address
  rateLimits: Map<string, RateLimit>; // ticker -> rate limit
  protocolAllowlist: ProtocolAllowlist;

  constructor(
    contracts: NocturneContractDeployment,
    protocolAllowlist: ProtocolAllowlist,
    gasAssets: Map<string, string>,
    rateLimits: Map<string, RateLimit>
  ) {
    this.contracts = contracts;
    this.gasAssets = gasAssets;
    this.rateLimits = rateLimits;
    this.protocolAllowlist = protocolAllowlist;
  }

  static fromObject<T extends NocturneConfigProperties>(
    obj: T
  ): NocturneConfig {
    return new NocturneConfig(
      obj.contracts,
      new Map(obj.protocolAllowlist),
      new Map(obj.gasAssets),
      new Map(obj.rateLimits)
    );
  }

  static fromString(str: string): NocturneConfig {
    const obj = JSON.parse(str) as NocturneConfigProperties;
    return NocturneConfig.fromObject(obj);
  }

  toString(): string {
    return JSON.stringify({
      contracts: this.contracts,
      protocolAllowlist: Array.from(this.protocolAllowlist.entries()),
      gasAssets: Array.from(this.gasAssets.entries()),
      rateLimits: Array.from(this.rateLimits.entries()),
    });
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

  startBlock(): number {
    return this.contracts.startBlock;
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

  const parsed = JSON.parse(json) as NocturneConfigProperties;
  return NocturneConfig.fromObject(parsed);
}
