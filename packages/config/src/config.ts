import { Address, NocturneContractDeployment } from "./deployment";
import sepolia from "../configs/sepolia.json";
import localhost from "../configs/localhost.json";
import exampleNetwork from "../configs/example-network.json";
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
  precision: bigint;
  isGasAsset: boolean;
}

export class NocturneConfig {
  contracts: NocturneContractDeployment;
  erc20s: Map<string, Erc20Config>;
  protocolAllowlist: Map<string, ProtocolAddressWithMethods>;

  constructor(
    contracts: NocturneContractDeployment,
    erc20s: Map<string, Erc20Config>,
    protocolAllowlist: Map<string, ProtocolAddressWithMethods>
  ) {
    this.contracts = contracts;
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
      erc20s: Array.from(this.erc20s),
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
    case "localhost":
      return NocturneConfig.fromObject(localhost as any);
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
export type NocturneConfig2 =
  | SepoliaConfig
  | LocalhostConfig
  | ExampleNetworkConfig;

export function getNetworkConfig(networkName: string): NocturneConfig2 {
  let network: NocturneConfig2;
  switch (networkName) {
    case "sepolia":
      network = { ...sepolia, type: "sepolia" } as const;
      const test = network.contracts satisfies NocturneContractDeployment;
      const erc20s = network.erc20s satisfies Record<string, Erc20Config>; // Type 'string' is not assignable to type 'bigint'.
      // not worth the time sink; unfortunately this is not a priority
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
