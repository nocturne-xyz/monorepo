import { ProxyAddresses } from "./proxy";

export type Address = string;

export interface Network {
  name: string;
  chainId: number;
}

export interface NocturneContractDeployment {
  network: Network;
  startBlock: number;
  proxyAdminOwner: Address;
  proxyAdmin: Address;
  depositManagerProxy: ProxyAddresses<any>;
  walletProxy: ProxyAddresses<any>;
  vaultProxy: ProxyAddresses<any>;
  joinSplitVerifier: Address;
  subtreeUpdateVerifier: Address;
  depositSources: Address[];
  screeners: Address[];
}
