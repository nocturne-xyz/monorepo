import { Address, CanonAddrRegistryEntry } from "./types";
import { ethers, TypedDataDomain } from "ethers";

const { _TypedDataEncoder } = ethers.utils;

const MODULUS_252 = BigInt(2) ** BigInt(252);

export const REGISTRY_CONTRACT_NAME = "NocturneCanonicalAddressRegistry";
export const REGISTRY_CONTRACT_VERSION = "v1";

export const CANON_ADDR_REGISTRY_ENTRY_TYPES = {
  CanonAddrRegistryEntry: [
    { name: "ethAddress", type: "address" },
    { name: "perCanonAddrNonce", type: "uint256" },
  ],
};

export function computeCanonAddrRegistryEntryDigest(
  entry: CanonAddrRegistryEntry,
  chainId: bigint,
  registryContract: Address
): bigint {
  const domain: TypedDataDomain = {
    name: REGISTRY_CONTRACT_NAME,
    version: REGISTRY_CONTRACT_VERSION,
    chainId,
    verifyingContract: registryContract,
  };

  const digest = _TypedDataEncoder.hash(
    domain,
    CANON_ADDR_REGISTRY_ENTRY_TYPES,
    entry
  );
  return BigInt(digest) % MODULUS_252;
}

export function hashCanonAddrRegistryEntry(
  entry: CanonAddrRegistryEntry
): string {
  return _TypedDataEncoder.hashStruct(
    "CanonAddrRegistryEntry",
    CANON_ADDR_REGISTRY_ENTRY_TYPES,
    entry
  );
}
