import { ProxyAddresses } from "./proxy";

export type Address = string;

export interface Network {
  name: string;
  chainId: number;
}

export interface NocturneContractDeployment {
  network: Network;
  startBlock: number;
  // TODO: consolidate owners once we've sorted out upgrade admin situation
  owners: {
    proxyAdminOwner: Address;
    contractOwner: Address;
  };
  proxyAdmin: Address;
  canonicalAddressRegistryProxy: ProxyAddresses<any>;
  depositManagerProxy: ProxyAddresses<any>;
  tellerProxy: ProxyAddresses<any>;
  handlerProxy: ProxyAddresses<any>;
  leftoverTokensHolder: Address;
  poseidonExtT7Address: Address;
  joinSplitVerifierAddress: Address;
  subtreeUpdateVerifierAddress: Address;
  canonAddrSigCheckVerifierAddress: Address;
}
