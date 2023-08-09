import { Address, NocturneContractDeployment } from "./deployment";
import * as sepolia from "../configs/sepolia.json";
import * as localhost from "../configs/localhost.json";
import * as exampleNetwork from "../configs/example-network.json";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";
import { ensureChecksumAddresses } from "./utils";

export interface Erc20Config {
  address: Address;
  globalCapWholeTokens: bigint;
  maxDepositSizeWholeTokens: bigint;
  precision: bigint;
  isGasAsset: boolean;
}

export type Erc20s =
  | typeof sepolia.erc20s
  | typeof localhost.erc20s
  | typeof exampleNetwork.erc20s;
export interface NocturneConfigProperties {
  contracts: NocturneContractDeployment;
  erc20s: Erc20s;
  protocolAllowlist: [string, Address][]; // name -> entry
}

export class NocturneConfig {
  contracts: NocturneContractDeployment;
  erc20s: Erc20s;
  protocolAllowlist: Map<string, Address>;

  constructor(
    contracts: NocturneContractDeployment,
    erc20s: Erc20s,
    protocolAllowlist: Map<string, Address>
  ) {
    this.contracts = contracts;
    this.erc20s = erc20s;
    this.protocolAllowlist = protocolAllowlist;
  }

  static fromObject<T extends NocturneConfigProperties>(
    obj: T
  ): NocturneConfig {
    obj = ensureChecksumAddresses(obj);

    return new NocturneConfig(
      obj.contracts,
      obj.erc20s,
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
      erc20s: this.erc20s,
      protocolAllowlist: Array.from(this.protocolAllowlist),
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
    return undefined; // ! TODO replace
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
    const parsed: NocturneConfigProperties = JSON.parse(json);
    return NocturneConfig.fromObject(parsed);
  } else {
    return loadNocturneConfigBuiltin(networkNameOrFilePath);
  }
}

export function loadNocturneConfigBuiltin(name: string): NocturneConfig {
  switch (name) {
    case "sepolia":
      return NocturneConfig.fromObject(sepolia as any);
    case "localnet":
      return NocturneConfig.fromObject(localhost.erc20s as any);
    case "example-network":
      return NocturneConfig.fromObject(exampleNetwork as any);
    default:
      throw new Error(`unknown config name: ${name}`);
  }
}

// TODO refactor above to this
type SepoliaConfig = { type: "sepolia" } & typeof sepolia;
type LocalhostConfig = { type: "localhost" } & typeof localhost;
type ExampleNetworkConfig = { type: "example-network" } & typeof exampleNetwork;
type NetworkConfig = SepoliaConfig | LocalhostConfig | ExampleNetworkConfig;

export function getNetworkConfig(networkName: string): NetworkConfig {
  let network: NetworkConfig;
  switch (networkName) {
    case "sepolia":
      network = { ...sepolia, type: "sepolia" };
      break;
    case "localhost":
      network = { ...localhost, type: "localhost" };
      break;
    case "example-network":
      network = { ...exampleNetwork, type: "example-network" };
      break;
    default:
      throw new Error(`Unknown config name: ${networkName}`);
  }
  return network;
}
