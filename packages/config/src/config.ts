import { Address, NocturneContractDeployment } from "./deployment";
import * as sepolia from "../configs/sepolia.json";
import * as localhost from "../configs/localhost.json";
import * as exampleNetwork from "../configs/example-network.json";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";

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
    obj = JSON.parse(JSON.stringify(obj));

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

  tellerAddress(): Address {
    return this.contracts.tellerProxy.proxy;
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
    const parsed = JSON.parse(json) as NocturneConfigProperties;
    return NocturneConfig.fromObject(parsed);
  } else {
    return loadNocturneConfigBuiltin(networkNameOrFilePath);
  }
}

export function loadNocturneConfigBuiltin(name: string): NocturneConfig {
  if (name == "sepolia") {
    return NocturneConfig.fromObject(sepolia as any);
  } else if (name == "localhost") {
    return NocturneConfig.fromObject(localhost as any);
  } else if (name == "example-network") {
    return NocturneConfig.fromObject(exampleNetwork as any);
  } else {
    throw new Error(`unknown config name: ${name}`);
  }
}
