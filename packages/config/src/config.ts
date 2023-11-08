import { Address, NocturneContractDeployment } from "./deployment";
import * as goerli from "../configs/goerli.json";
import * as localhost from "../configs/localhost.json";
import * as exampleNetwork from "../configs/example-network.json";
import * as mainnet from "../configs/mainnet.json";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";
import { ensureChecksumAddresses } from "./utils";

export interface ProtocolAddressWithMethods {
  address: Address;
  functionSignatures: string[];
}

export interface Erc20Config {
  address: Address;
  globalCapWholeTokens: bigint;
  maxDepositSizeWholeTokens: bigint;
  resetWindowHours: bigint;
  precision: bigint;
  isGasAsset: boolean;
}

export interface OffchainConfig {
  finalityBlocks: number;
  screeners: Address[];
  subtreeBatchFillers: Address[];
}

export interface NocturneConfigProperties {
  contracts: NocturneContractDeployment;
  offchain: OffchainConfig;
  erc20s: [string, Erc20Config][]; // ticker -> erc20 config
  protocolAllowlist: [string, ProtocolAddressWithMethods][]; // name -> entry
}

export class NocturneConfig {
  contracts: NocturneContractDeployment;
  offchain: OffchainConfig;
  erc20s: Map<string, Erc20Config>; // ticker -> erc20 config
  protocolAllowlist: Map<string, ProtocolAddressWithMethods>;

  constructor(
    contracts: NocturneContractDeployment,
    offchain: OffchainConfig,
    erc20s: Map<string, Erc20Config>,
    protocolAllowlist: Map<string, ProtocolAddressWithMethods>
  ) {
    this.contracts = contracts;
    this.offchain = offchain;
    this.erc20s = erc20s;
    this.protocolAllowlist = protocolAllowlist;
  }

  static fromObject<T extends NocturneConfigProperties>(
    obj: T
  ): NocturneConfig {
    obj = JSON.parse(JSON.stringify(obj));
    obj = ensureChecksumAddresses(obj);

    return new NocturneConfig(
      obj.contracts,
      obj.offchain,
      new Map(obj.erc20s),
      new Map(obj.protocolAllowlist)
    );
  }

  static fromString(str: string): NocturneConfig {
    const props: NocturneConfigProperties = JSON.parse(str);
    return NocturneConfig.fromObject(props);
  }

  toString(): string {
    return JSON.stringify({
      contracts: this.contracts,
      offchain: this.offchain,
      erc20s: Array.from(this.erc20s),
      protocolAllowlist: Array.from(this.protocolAllowlist),
    });
  }

  get networkName(): string {
    return this.contracts.network.name;
  }

  get chainId(): bigint {
    return BigInt(this.contracts.network.chainId);
  }

  get finalityBlocks(): number | undefined {
    return this.offchain.finalityBlocks;
  }

  get startBlock(): number {
    return this.contracts.startBlock;
  }

  get canonicalAddressRegistryAddress(): Address {
    return this.contracts.canonicalAddressRegistryProxy.proxy;
  }

  get tellerAddress(): Address {
    return this.contracts.tellerProxy.proxy;
  }

  get handlerAddress(): Address {
    return this.contracts.handlerProxy.proxy;
  }

  get depositManagerAddress(): Address {
    return this.contracts.depositManagerProxy.proxy;
  }

  erc20(ticker: string): Erc20Config | undefined {
    return this.erc20s.get(ticker);
  }
}

export function loadNocturneConfig(
  networkNameOrFilePath: string
): NocturneConfig {
  let json: string;
  if (fs.existsSync(networkNameOrFilePath)) {
    json = fs.readFileSync(networkNameOrFilePath).toString();
    const parsed: NocturneConfigProperties = JSON.parse(json);
    return NocturneConfig.fromObject(parsed);
  } else {
    return loadNocturneConfigBuiltin(networkNameOrFilePath);
  }
}

export function loadNocturneConfigBuiltin(name: string): NocturneConfig {
  switch (name) {
    case "mainnet":
      return NocturneConfig.fromObject(mainnet as any);
    case "goerli":
      return NocturneConfig.fromObject(goerli as any);
    case "localhost":
      return NocturneConfig.fromObject(localhost as any);
    case "example-network":
      return NocturneConfig.fromObject(exampleNetwork as any);
    default:
      throw new Error(`unknown config name: ${name}`);
  }
}
