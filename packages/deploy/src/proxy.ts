import { Contract, ethers } from "ethers";
import { ProxyAddresses } from "@nocturne-xyz/config";

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
