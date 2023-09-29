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
    tellerOwner: Address;
    handlerOwner: Address;
    depositManagerOwner: Address;
  };
  proxyAdmin: Address;
  finalityBlocks: number;
  canonicalAddressRegistryProxy: ProxyAddresses<any>;
  depositManagerProxy: ProxyAddresses<any>;
  tellerProxy: ProxyAddresses<any>;
  handlerProxy: ProxyAddresses<any>;
  poseidonExtT7Address: Address;
  joinSplitVerifierAddress: Address;
  subtreeUpdateVerifierAddress: Address;
  canonAddrSigCheckVerifierAddress: Address;
  depositSources: Address[];
  screeners: Address[];
}
