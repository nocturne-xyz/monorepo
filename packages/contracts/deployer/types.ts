import { ProxyAdmin } from '../src/ProxyAdmin';

export interface ProxiedContract {
  proxyAddress: string;
  implementationAddress: string;
}

export interface Network {
  name: string;
  chainId: number;
}

export interface NocturneDeployment {
  network: Network;
  startBlock: number;
  proxyAdminOwner: string;
  proxyAdmin: string;
  walletProxy: ProxiedContract;
  vaultProxy: ProxiedContract;
  joinSplitVerifierAddress: string;
  subtreeUpdateVerifierAddress: string;
}

export interface NocturneDeployOpts {
  proxyAdmin?: ProxyAdmin;
  provider?: any; // FIX: ts build within hh disallows ethers.providers.Provider
  mockSubtreeUpdateVerifier?: boolean;
  confirmations?: number;
}
