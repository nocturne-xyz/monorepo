import {
  NocturneConfig,
  loadNocturneConfigBuiltin,
} from "@nocturne-xyz/config";
import { Asset, AssetTrait } from "@nocturne-xyz/core";
import { AssetType } from "@nocturne-xyz/core/src";
import { ethers } from "ethers";

export const WETH_ADDRESS = ethers.utils.getAddress(
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
);
export const WSTETH_ADAPTER_ADDRESS = ethers.utils.getAddress(
  "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"
);
export const WSTETH_ADDRESS = ethers.utils.getAddress(
  "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"
);

export const DUMMY_CONTRACT_ADDR = ethers.utils.getAddress(
  "0x67f8f9a5d4290325506b119980660624dc7d3ba9"
);

export const shitcoin: Asset = {
  assetType: AssetType.ERC20,
  assetAddr: ethers.utils.getAddress(
    "0xddbd1e80090943632ed47b1632cb36e7ca28abc2"
  ),
  id: 0n,
};
export const encodedShitcoin = AssetTrait.encode(shitcoin);

const config = loadNocturneConfigBuiltin("example-network");
config.erc20s.set("weth", {
  address: WETH_ADDRESS,
  globalCapWholeTokens: 100_000_000n,
  maxDepositSizeWholeTokens: 100_000_000n,
  resetWindowHours: 24n,
  precision: 18n,
  isGasAsset: true,
});
config.erc20s.set("wsteth", {
  address: WSTETH_ADDRESS,
  globalCapWholeTokens: 100_000_000n,
  maxDepositSizeWholeTokens: 100_000_000n,
  resetWindowHours: 24n,
  precision: 18n,
  isGasAsset: false,
});
config.protocolAllowlist.set("wstethAdapter", {
  address: WSTETH_ADAPTER_ADDRESS,
  functionSignatures: ["convert(uint256)"],
});
export const DUMMY_CONFIG: NocturneConfig = config;
