import { Address, AssetType } from "@nocturne-xyz/sdk";
import { ethers } from "ethers";
import ERC20 from "./abis/ERC20.json";
import ERC721 from "./abis/ERC721.json";
import ERC1155 from "./abis/ERC1155.json";
import { NocturneSdkConfig, SupportedNetwork } from "./types";
import { loadNocturneConfigBuiltin } from "@nocturne-xyz/config";
export interface TokenDetails {
  decimals: number;
  symbol: string;
}

const ENDPOINTS = {
  sepolia: {
    screenerEndpoint: "https://screener.nocturnelabs.xyz",
    bundlerEndpoint: "https://bundler.nocturnelabs.xyz",
  },
  localnet: {
    screenerEndpoint: "http://localhost:8000",
    bundlerEndpoint: "http://localhost:8000",
  },
};

export const SNAP_ID =
  process.env.NEXT_PUBLIC_SNAP_ORIGIN ??
  process.env.REACT_APP_SNAP_ORIGIN ??
  `local:http://localhost:8080`;
export const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ??
  "http://localhost:8000/subgraphs/name/nocturne";

console.log("SNAP_ID: ", SNAP_ID);
console.log("SUBGRAPH_URL: ", SUBGRAPH_URL);

export async function getWindowSigner(): Promise<ethers.Signer> {
  const provider = new ethers.providers.Web3Provider(window.ethereum as any);
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

export function getTokenContract(
  assetType: AssetType,
  assetAddress: Address,
  signerOrProvider: ethers.Signer | ethers.providers.Provider
): ethers.Contract {
  let abi;
  if (assetType == AssetType.ERC20) {
    abi = ERC20;
  } else if (assetType == AssetType.ERC721) {
    abi = ERC721;
  } else if (assetType == AssetType.ERC1155) {
    abi = ERC1155;
  } else {
    throw new Error(`unknown asset type: ${assetType}`);
  }

  return new ethers.Contract(assetAddress, abi, signerOrProvider);
}

export async function getTokenDetails(
  assetType: AssetType,
  assetAddress: Address,
  signerOrProvider: ethers.Signer | ethers.providers.Provider
): Promise<TokenDetails> {
  console.log("getting token contract...");
  const tokenContract = getTokenContract(
    assetType,
    assetAddress,
    signerOrProvider
  );

  if (assetType == AssetType.ERC20) {
    const decimals = await tokenContract.decimals();
    const symbol = await tokenContract.symbol();
    return { decimals, symbol };
  } else if (assetType == AssetType.ERC721) {
    const symbol = await tokenContract.symbol();
    return { decimals: 1, symbol };
  } else if (assetType == AssetType.ERC1155) {
    return { decimals: 1, symbol: "" };
  } else {
    throw new Error(`unknown asset variant: ${assetType}`);
  }
}

export function formatTokenAmountUserRepr(
  balance: bigint,
  decimals: number
): number {
  return Number(balance) / Math.pow(10, decimals);
}

export function formatTokenAmountEvmRepr(
  amount: number,
  decimals: number
): bigint {
  return BigInt(amount * Math.pow(10, decimals));
}

export function formatAbbreviatedAddress(address: string): string {
  return (
    address.substring(0, 6) +
    "..." +
    address.substring(address.length - 4)
  ).toLowerCase();
}

const getEndpoints = (networkName: SupportedNetwork) => {
  switch (networkName) {
    case "sepolia":
      return ENDPOINTS.sepolia;
    case "localnet":
      return ENDPOINTS.localnet;
    default:
      throw new Error(`Network not supported: ${networkName}`);
  }
};

export const getNocturneSdkConfig = (
  networkName: SupportedNetwork
): NocturneSdkConfig => {
  const config = loadNocturneConfigBuiltin(networkName);
  const endpoints = getEndpoints(networkName);
  return {
    network: config,
    endpoints,
  };
};
