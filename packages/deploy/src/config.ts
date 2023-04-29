import { ProxyAdmin } from "@nocturne-xyz/contracts";
import { Address } from "./utils";

export interface NocturneDeployConfig {
  proxyAdminOwner: Address;
  screeners: Address[];
  subtreeBatchFillers: Address[];
  wethAddress: Address;
  protocolWhitelist: Map<string, ProtocolWhitelistEntry>;
  opts?: NocturneDeployOpts;
}

export interface NocturneDeployOpts {
  proxyAdmin?: ProxyAdmin;
  useMockSubtreeUpdateVerifier?: boolean;
  confirmations?: number;
}

export interface ProtocolWhitelistEntry {
  contractAddress: Address;
  functionSignatures: string[];
}
