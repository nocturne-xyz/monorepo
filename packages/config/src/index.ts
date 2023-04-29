import * as localhost from "../configs/localhost.json";
import { NocturneConfig } from "./config";

export {
  loadNocturneConfig,
  NocturneConfig,
  ProtocolAllowlist,
  ProtocolWhitelistEntry,
} from "./config";
export { NocturneContractDeployment } from "./deployment";
export * from "./proxy";

export function loadNocturneConfigBuiltin(name: string): NocturneConfig {
  if (name == "localhost") {
    return NocturneConfig.fromObject(localhost as any);
  } else {
    throw new Error(`unknown config name: ${name}`);
  }
}
