import { Contract, ethers } from "ethers";
import { Address } from "./types";

export enum ProxyKind {
  Transparent = "Transparent",
}

export interface ProxyAddresses<Kind extends ProxyKind> {
  kind: Kind;
  proxy: Address;
  implementation: Address;
}

export type TransparentProxyAddresses = ProxyAddresses<ProxyKind.Transparent>;

export class ProxiedContract<
  C extends Contract,
  A extends ProxyAddresses<any>
> {
  constructor(public readonly contract: C, public readonly addresses: A) {}

  get address(): string {
    return this.contract.address;
  }

  get proxyAddresses(): ProxyAddresses<any> {
    return this.addresses;
  }

  connect(
    connection: ethers.Signer | ethers.providers.Provider
  ): ProxiedContract<C, A> {
    return new ProxiedContract(
      this.contract.connect(connection) as C,
      this.addresses
    );
  }
}
