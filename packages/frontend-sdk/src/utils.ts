import { loadNocturneConfigBuiltin } from "@nocturne-xyz/config";
import {
  Address,
  AssetTrait,
  AssetType,
  DepositRequest,
  DepositRequestStatus as ScreenerDepositRequestStatus,
} from "@nocturne-xyz/core";
import { ethers } from "ethers";
import ERC1155 from "./abis/ERC1155.json";
import ERC20 from "./abis/ERC20.json";
import ERC721 from "./abis/ERC721.json";
import {
  DepositRequestStatus,
  NocturneSdkConfig,
  SupportedNetwork,
  Endpoints,
  TokenDetails,
  DisplayDepositRequest,
  OnChainDepositRequestStatus,
} from "./types";

const ENDPOINTS = {
  goerli: {
    screenerEndpoint: "https://screener.testnet.nocturnelabs.xyz",
    bundlerEndpoint: "https://bundler.testnet.nocturnelabs.xyz",
    subgraphEndpoint:
      process.env.NEXT_PUBLIC_SUBGRAPH_URL ??
      "https://api.goldsky.com/api/public/project_cldkt6zd6wci33swq4jkh6x2w/subgraphs/nocturne/0.1.21-testnet/gn",
  },
  localhost: {
    screenerEndpoint: "http://localhost:3001",
    bundlerEndpoint: "http://localhost:3000",
    subgraphEndpoint: "http://localhost:8000/subgraphs/name/nocturne",
  },
};

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

export interface CircuitArtifactUrlsInner {
  wasm: string;
  zkey: string;
  vkey: string;
}

export interface CircuitArtifactUrls {
  joinSplit: CircuitArtifactUrlsInner;
  canonAddrSigCheck: CircuitArtifactUrlsInner;
}

export function getCircuitArtifactUrls(
  networkName: SupportedNetwork
): CircuitArtifactUrls {
  switch (networkName) {
    case "goerli":
      return {
        joinSplit: {
          wasm: "https://nocturne-circuit-artifacts-goerli.s3.us-east-2.amazonaws.com/joinsplit/joinsplit.wasm",
          zkey: "https://nocturne-circuit-artifacts-goerli.s3.us-east-2.amazonaws.com/joinsplit/joinsplit.zkey",
          vkey: "https://nocturne-circuit-artifacts-goerli.s3.us-east-2.amazonaws.com/joinsplit/joinsplitVkey.json",
        },
        canonAddrSigCheck: {
          wasm: "https://nocturne-circuit-artifacts-goerli.s3.us-east-2.amazonaws.com/canonAddrSigCheck/canonAddrSigCheck.wasm",
          zkey: "https://nocturne-circuit-artifacts-goerli.s3.us-east-2.amazonaws.com/canonAddrSigCheck/canonAddrSigCheck.zkey",
          vkey: "https://nocturne-circuit-artifacts-goerli.s3.us-east-2.amazonaws.com/canonAddrSigCheck/canonAddrSigCheckVkey.json",
        },
      };
    case "localhost":
      return {
        joinSplit: {
          wasm: "https://nocturne-circuit-artifacts-localhost.s3.us-east-2.amazonaws.com/joinsplit/joinsplit.wasm",
          zkey: "https://nocturne-circuit-artifacts-localhost.s3.us-east-2.amazonaws.com/joinsplit/joinsplit.zkey",
          vkey: "https://nocturne-circuit-artifacts-localhost.s3.us-east-2.amazonaws.com/joinsplit/joinsplitVkey.json",
        },
        canonAddrSigCheck: {
          wasm: "https://nocturne-circuit-artifacts-localhost.s3.us-east-2.amazonaws.com/canonAddrSigCheck/canonAddrSigCheck.wasm",
          zkey: "https://nocturne-circuit-artifacts-localhost.s3.us-east-2.amazonaws.com/canonAddrSigCheck/canonAddrSigCheck.zkey",
          vkey: "https://nocturne-circuit-artifacts-localhost.s3.us-east-2.amazonaws.com/canonAddrSigCheck/canonAddrSigCheckVkey.json",
        },
      };
    default:
      throw new Error(`Network not supported: ${networkName}`);
  }
}

export function getNocturneSdkConfig(
  networkName: SupportedNetwork
): NocturneSdkConfig {
  const config = loadNocturneConfigBuiltin(networkName);

  let endpoints: Endpoints;
  switch (networkName) {
    case "goerli":
      endpoints = ENDPOINTS.goerli;
      break;
    case "localhost":
      endpoints = ENDPOINTS.localhost;
      break;
    default:
      throw new Error(`Network not supported: ${networkName}`);
  }

  return {
    config,
    endpoints,
  };
}



export function toDepositRequest(
  displayDepositRequest: DisplayDepositRequest
): DepositRequest {
  const asset = {
    ...displayDepositRequest.asset,
    id: displayDepositRequest.asset.id.toBigInt(),
  };
  return {
    spender: displayDepositRequest.spender,
    encodedAsset: AssetTrait.encode(asset),
    value: displayDepositRequest.value.toBigInt(),
    depositAddr: {
      h1: displayDepositRequest.depositAddr.h1.toBigInt(),
      h2: displayDepositRequest.depositAddr.h2.toBigInt(),
    },
    nonce: displayDepositRequest.nonce.toBigInt(),
    gasCompensation: displayDepositRequest.gasCompensation.toBigInt(),
  };
}

export function flattenDepositRequestStatus(
  subgraphStatus: OnChainDepositRequestStatus,
  screenerStatus: ScreenerDepositRequestStatus
): DepositRequestStatus {
  switch (subgraphStatus) {
    case OnChainDepositRequestStatus.Retrieved:
      return DepositRequestStatus.Retrieved;
    case OnChainDepositRequestStatus.Completed:
      // ! TODO need access to logic to distinguish between FULFILLED and COMPLETE. COMPLETE if new note is committed in tree, FULFILLED otherwise
      return DepositRequestStatus.Complete;
    case OnChainDepositRequestStatus.Pending: {
      switch (screenerStatus) {
        case ScreenerDepositRequestStatus.FailedScreen:
          return DepositRequestStatus.FailedScreen;
        case ScreenerDepositRequestStatus.PassedFirstScreen:
        case ScreenerDepositRequestStatus.AwaitingFulfillment:
          return DepositRequestStatus.AwaitingFulfillment;
        default:
          return DepositRequestStatus.Initiated;
      }
    }
    default:
      throw new Error(`Unknown subgraph status: ${subgraphStatus}`);
  }
}
