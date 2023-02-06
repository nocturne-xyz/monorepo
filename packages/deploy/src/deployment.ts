import { ProxyAddresses } from "./proxy";

export type Address = string;

export interface Network {
  name: string;
  chainId: number;
}

export interface NocturneDeployment {
  network: Network;
  startBlock: number;
  proxyAdminOwner: Address;
  proxyAdmin: Address;
  walletProxy: ProxyAddresses<any>;
  vaultProxy: ProxyAddresses<any>;
  joinSplitVerifier: Address;
  subtreeUpdateVerifier: Address;
}
