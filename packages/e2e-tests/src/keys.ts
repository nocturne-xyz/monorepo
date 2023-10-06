import { ethers } from "ethers";

// default anvil keys
// corresponds to mnemonic `test test test test test test test test test test test junk`
// and derivation path `m/44'/60'/0'/0/`
export const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // anvil #0
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // anvil #1
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // anvil #2
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // anvil #3
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // anvil #4
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // anvil #5
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", // anvil #6
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356", // anvil #7
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97", // anvil #8
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6", // anvil #9
];

export const ADDRESSES = KEYS.map(
  (k) => new ethers.Wallet(k).connect(ethers.getDefaultProvider()).address
);

export function KEYS_TO_WALLETS(
  provider: ethers.providers.Provider
): ethers.Wallet[] {
  return KEYS.map((k) => new ethers.Wallet(k, provider));
}
