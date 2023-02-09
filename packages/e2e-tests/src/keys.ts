import { ethers } from "ethers";

export const ACTORS_TO_KEYS = {
  deployer:
    "0x0000000000000000000000000000000000000000000000000000000000000001",
  alice: "0x0000000000000000000000000000000000000000000000000000000000000002",
  bob: "0x0000000000000000000000000000000000000000000000000000000000000003",
  bundler: "0x0000000000000000000000000000000000000000000000000000000000000004",
  subtreeUpdater:
    "0x0000000000000000000000000000000000000000000000000000000000000005",
};

export function ACTORS_TO_WALLETS(provider: ethers.providers.Provider): {
  [k: string]: ethers.Wallet;
} {
  return Object.fromEntries(
    Object.entries(ACTORS_TO_KEYS).map(([name, key]) => {
      return [name, new ethers.Wallet(key, provider)];
    })
  );
}

export function KEY_LIST(): string[] {
  return Array.from(Object.values(ACTORS_TO_KEYS));
}
