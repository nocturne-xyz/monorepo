import { ProtocolAllowlist } from "@nocturne-xyz/config";
import { Address } from "./utils";
import { ProxyAdmin } from "@nocturne-xyz/contracts";

export interface NocturneDeployConfig {
  proxyAdminOwner: Address;
  screeners: Address[];
  subtreeBatchFillers: Address[];
  wethAddress: Address;
  protocolAllowlist: ProtocolAllowlist;
  opts?: NocturneDeployOpts;
}

export interface NocturneDeployOpts {
  proxyAdmin?: ProxyAdmin;
  useMockSubtreeUpdateVerifier?: boolean;
  confirmations?: number;
}
