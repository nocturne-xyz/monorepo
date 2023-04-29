import { ProxyAdmin } from "@nocturne-xyz/contracts";
import { Address } from "./utils";

export interface NocturneDeployConfig {
  proxyAdminOwner: Address;
  screeners: Address[];
  subtreeBatchFillers: Address[];
  wethAddress: Address;
  opts?: NocturneDeployOpts;
}

export interface NocturneDeployOpts {
  proxyAdmin?: ProxyAdmin;
  useMockSubtreeUpdateVerifier?: boolean;
  confirmations?: number;
}

export type ProtocolWhitelistConfig = Map<string, ProtocolWhitelistEntry>;

export interface ProtocolWhitelistEntry {
  contractAddress: Address;
  functionSignatures: string[];
}
