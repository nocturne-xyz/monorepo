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
    walletOwner: Address;
    depositManagerOwner: Address;
  };
  proxyAdmin: Address;
  depositManagerProxy: ProxyAddresses<any>;
  walletProxy: ProxyAddresses<any>;
  handlerProxy: ProxyAddresses<any>;
  joinSplitVerifierAddress: Address;
  subtreeUpdateVerifierAddress: Address;
  depositSources: Address[];
  screeners: Address[];
}
