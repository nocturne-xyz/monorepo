import { Address } from "./deployment";

export enum ProxyKind {
  Transparent = "Transparent",
}

export interface ProxyAddresses<Kind extends ProxyKind> {
  kind: Kind;
  proxy: Address;
  implementation: Address;
}

export type TransparentProxyAddresses = ProxyAddresses<ProxyKind.Transparent>;
