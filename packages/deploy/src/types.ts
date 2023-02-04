import { ProxyAdmin } from "@nocturne-xyz/contracts";
import { ProxyAddresses } from "./proxy";

export type Address = string;

export interface Network {
  name: string;
  chainId: number;
}

export interface NocturneDeployment {
  network: Network;
  startBlock: number;
  proxyAdminOwner: string;
  proxyAdmin: string;
  walletProxy: ProxyAddresses<any>;
  vaultProxy: ProxyAddresses<any>;
  joinSplitVerifierAddress: string;
  subtreeUpdateVerifierAddress: string;
}

export interface NocturneDeployOpts {
  proxyAdmin?: ProxyAdmin;
  provider?: any; // FIX: ts build within hh disallows ethers.providers.Provider
  useMockSubtreeUpdateVerifier?: boolean;
  confirmations?: number;
}
