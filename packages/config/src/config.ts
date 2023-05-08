import { Address, NocturneContractDeployment } from "./deployment";
import * as sepolia from "../configs/sepolia.json";
import * as localhost from "../configs/localhost.json";
import * as exampleNetwork from "../configs/example-network.json";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";

interface Erc20Config {
  address: Address;
  globalCapWholeTokens: bigint;
  maxDepositSizeWholeTokens: bigint;
  precision: bigint;
  isGasAsset: boolean;
}

export interface NocturneConfigProperties {
  contracts: NocturneContractDeployment;
  erc20s: [string, Erc20Config][]; // ticker -> erc20 config
  protocolAllowlist: [string, Address][]; // name -> entry
}

export class NocturneConfig {
  contracts: NocturneContractDeployment;
  erc20s: Map<string, Erc20Config>; // ticker -> erc20 config
  protocolAllowlist: Map<string, Address>;

  constructor(
    contracts: NocturneContractDeployment,
    erc20s: Map<string, Erc20Config>,
    protocolAllowlist: Map<string, Address>
  ) {
    this.contracts = contracts;
    this.erc20s = erc20s;
    this.protocolAllowlist = protocolAllowlist;
  }

  static fromObject<T extends NocturneConfigProperties>(
    obj: T
  ): NocturneConfig {
    obj = JSON.parse(JSON.stringify(obj));

    return new NocturneConfig(
      obj.contracts,
      new Map(obj.erc20s),
      new Map(obj.protocolAllowlist)
    );
  }

  static fromString(str: string): NocturneConfig {
    const obj = JSON.parse(str) as NocturneConfigProperties;
    return NocturneConfig.fromObject(obj);
  }

  toString(): string {
    return JSON.stringify({
      contracts: this.contracts,
      erc20s: Array.from(this.erc20s.entries()),
      protocolAllowlist: Array.from(this.protocolAllowlist.entries()),
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

  erc20(ticker: string): Erc20Config | undefined {
    return this.erc20s.get(ticker);
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
  switch (name) {
    case "sepolia":
      return NocturneConfig.fromObject(sepolia as any);
    case "localhost":
      return NocturneConfig.fromObject(localhost as any);
    case "example-network":
      return NocturneConfig.fromObject(exampleNetwork as any);
    default:
      throw new Error(`unknown config name: ${name}`);
  }
}
