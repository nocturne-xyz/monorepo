import { Address } from "@nocturne-xyz/core";
import { ProxyAdmin } from "@nocturne-xyz/contracts";
import { Erc20Config, ProtocolAddressWithMethods } from "@nocturne-xyz/config";
import * as JSON from "bigint-json-serialization";

export interface NocturneDeployConfigProperties {
  proxyAdminOwner: Address;
  contractOwner: Address;
  screeners: Address[];
  subtreeBatchFillers: Address[];
  wethAddress: Address;
  erc20s: [string, Erc20Config][];
  protocolAllowlist: [string, ProtocolAddressWithMethods][];
  leftoverTokenHolder: Address;
  finalityBlocks: number;
  opts?: NocturneDeployOpts;
}

export interface NocturneDeployConfig {
  proxyAdminOwner: Address;
  contractOwner: Address;
  screeners: Address[];
  subtreeBatchFillers: Address[];
  wethAddress: Address;
  erc20s: Map<string, Erc20Config>;
  protocolAllowlist: Map<string, ProtocolAddressWithMethods>;
  leftoverTokenHolder: Address;
  finalityBlocks: number;
  opts?: NocturneDeployOpts;
}

export interface NocturneDeployOpts {
  proxyAdmin?: ProxyAdmin;
  uniswapV3AdapterDeployConfig?: UniswapV3AdapterDeployConfig;
  wstethAdapterDeployConfig?: WstethAdapterDeployConfig;
  rethAdapterDeployConfig?: RethAdapterDeployConfig;
  useMockSubtreeUpdateVerifier?: boolean;
  confirmations?: number;
}

export interface UniswapV3AdapterDeployConfig {
  swapRouterAddress: Address;
}

export interface WstethAdapterDeployConfig {
  wstethAddress: Address;
}

export interface RethAdapterDeployConfig {
  rocketPoolStorageAddress: Address;
}

export function loadDeployConfigFromJSON(json: string): NocturneDeployConfig {
  const props: NocturneDeployConfigProperties = JSON.parse(json);
  return {
    ...props,
    erc20s: new Map(props.erc20s),
    protocolAllowlist: new Map(props.protocolAllowlist),
  };
}
