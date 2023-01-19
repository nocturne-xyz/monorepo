export interface ProxiedContract {
  proxyAddress: string;
  implementationAddress: string;
}

export interface NocturneDeployment {
  proxyAdminAddress: string;
  walletProxy: ProxiedContract;
  vaultProxy: ProxiedContract;
  joinSplitVerifierAddress: string;
  subtreeUpdateVerifierAddress: string;
}

export interface NocturneDeployOpts {
  mockSubtreeUpdateVerifier: boolean;
}
