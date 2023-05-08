import { Address } from "./utils";
import { ProxyAdmin } from "@nocturne-xyz/contracts";

export interface NocturneDeployConfig {
  proxyAdminOwner: Address;
  screeners: Address[];
  subtreeBatchFillers: Address[];
  wethAddress: Address;
  // erc20s: Erc20DeployConfig[];
  protocolAllowlist: Map<string, Address>;
  opts?: NocturneDeployOpts;
}

export interface NocturneDeployOpts {
  proxyAdmin?: ProxyAdmin;
  useMockSubtreeUpdateVerifier?: boolean;
  confirmations?: number;
}
