import { ProxyAdmin } from '../src/ProxyAdmin';

export interface ProxiedContract {
  proxyAddress: string;
  implementationAddress: string;
}

export interface NocturneDeployment {
  proxyAdminOwner: string;
  proxyAdmin: string;
  walletProxy: ProxiedContract;
  accountantProxy: ProxiedContract;
  joinSplitVerifierAddress: string;
  subtreeUpdateVerifierAddress: string;
}

export interface NocturneDeployOpts {
  proxyAdmin?: ProxyAdmin;
  provider?: any; // FIX: ts build within hh disallows ethers.providers.Provider
  mockSubtreeUpdateVerifier?: boolean;
  confirmations?: number;
}
