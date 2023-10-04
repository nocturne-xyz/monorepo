import { Address, CanonAddrRegistryEntry } from "./types";
import { ethers, TypedDataDomain } from "ethers";

const { _TypedDataEncoder } = ethers.utils;

const BOTTOM_252_MASK = (1n << 252n) - 1n;

const REGISTRY_CONTRACT_NAME = "NocturneCanonicalAddressRegistry";
const REGISTRY_CONTRACT_VERSION = "v1";

export const __CANON_ADDR_REGISTRY_ENTRY_TYPES = {
  CanonAddrRegistryEntry: [
    { name: "ethAddress", type: "address" },
    { name: "compressedCanonAddr", type: "uint256" },
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
    __CANON_ADDR_REGISTRY_ENTRY_TYPES,
    entry
  );
  return BigInt(digest) & BOTTOM_252_MASK;
}

export function hashCanonAddrRegistryEntry(
  entry: CanonAddrRegistryEntry
): string {
  return _TypedDataEncoder.hashStruct(
    "CanonAddrRegistryEntry",
    __CANON_ADDR_REGISTRY_ENTRY_TYPES,
    entry
  );
}
