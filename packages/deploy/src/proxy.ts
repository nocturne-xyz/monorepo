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

export function isProxyAddresses(
  addresses: unknown
): addresses is ProxyAddresses<any> {
  return (
    addresses !== null &&
    typeof addresses === "object" &&
    "proxy" in addresses &&
    "implementation" in addresses &&
    "kind" in addresses &&
    Object.keys(ProxyKind).includes((addresses as any).kind)
  );
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

export async function proxyImplementation(
  provider: ethers.providers.Provider,
  proxy: Address
): Promise<Address> {
  // Hardcoded storage slot for implementation per EIP-1967
  const storageValue = await provider.getStorageAt(
    proxy,
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  );
  return ethers.utils.getAddress(storageValue.slice(26));
}

export async function proxyAdmin(
  provider: ethers.providers.Provider,
  proxy: Address
): Promise<Address> {
  // Hardcoded storage slot for admin per EIP-1967
  const storageValue = await provider.getStorageAt(
    proxy,
    "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
  );
  return ethers.utils.getAddress(storageValue.slice(26));
}
