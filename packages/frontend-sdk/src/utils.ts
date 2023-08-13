import { loadNocturneConfigBuiltin } from "@nocturne-xyz/config";
import {
  Address,
  AssetType,
  DepositRequestStatus as ScreenerDepositRequestStatus,
  TotalEntityIndexTrait,
} from "@nocturne-xyz/core";
import { ethers } from "ethers";
import { OperationResult } from "urql";
import ERC1155 from "./abis/ERC1155.json";
import ERC20 from "./abis/ERC20.json";
import ERC721 from "./abis/ERC721.json";
import {
  FetchDepositRequestsQuery,
  DepositRequest as GqlDepositRequest,
  DepositRequestStatus as GqlDepositRequestStatus,
} from "./gql/autogenerated/graphql";
import { DepositRequestsBySpenderQueryDocument } from "./gql/queries/DepositRequestsBySpenderQueryDocument";
import { getUrqlClient } from "./gql/urqlClient";
import {
  DepositRequestStatus,
  DepositRequestWithMetadata,
  NocturneSdkConfig,
  SupportedNetwork,
} from "./types";

export interface TokenDetails {
  decimals: number;
  symbol: string;
}

export interface Endpoints {
  screenerEndpoint: string;
  bundlerEndpoint: string;
}

const ENDPOINTS = {
  sepolia: {
    screenerEndpoint: "https://screener.nocturnelabs.xyz",
    bundlerEndpoint: "https://bundler.nocturnelabs.xyz",
  },
  localhost: {
    screenerEndpoint: "http://localhost:3001",
    bundlerEndpoint: "http://localhost:3000",
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

export type ValidProvider =
  | ethers.providers.JsonRpcProvider
  | ethers.providers.Web3Provider;

export function getProvider(): ValidProvider {
  return new ethers.providers.Web3Provider(window?.ethereum as any);
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

export function getEndpoints(networkName: SupportedNetwork): Endpoints {
  switch (networkName) {
    case "sepolia":
      return ENDPOINTS.sepolia;
    case "localhost":
      return ENDPOINTS.localhost;
    default:
      throw new Error(`Network not supported: ${networkName}`);
  }
};

export function getNocturneSdkConfig(
  networkName: SupportedNetwork
): NocturneSdkConfig {
  const config = loadNocturneConfigBuiltin(networkName);
  const endpoints = getEndpoints(networkName);
  return {
    config,
    endpoints,
  };
};

export function convertToBlockNumber(createdAtTotalEntityIndex: bigint): number {
  return Number(
    TotalEntityIndexTrait.toComponents(createdAtTotalEntityIndex).blockNumber
  );
};

export function toDepositRequestWithMetadata(
  gqlDeposit: Omit<GqlDepositRequest, "id">
): DepositRequestWithMetadata & {
  subgraphStatus: GqlDepositRequestStatus;
} {
  const {
    spender,
    status,
    value,
    nonce,
    gasCompensation,
    encodedAssetAddr,
    encodedAssetId,
    depositAddrH1,
    depositAddrH2,
    instantiationTxHash,
    completionTxHash,
    retrievalTxHash,
  } = gqlDeposit;
  return {
    spender,
    subgraphStatus: status,
    value,
    nonce,
    gasCompensation,
    encodedAsset: {
      encodedAssetAddr,
      encodedAssetId,
    },
    depositAddr: {
      h1: depositAddrH1,
      h2: depositAddrH2,
    },
    createdAtBlock: convertToBlockNumber(
      BigInt(gqlDeposit.createdAtTotalEntityIndex)
    ),
    txHashInstantiated: instantiationTxHash,
    txHashCompleted: completionTxHash,
    txHashRetrieved: retrievalTxHash,
  };
};

export function toDepositRequestStatus(
  subgraphStatus: GqlDepositRequestStatus,
  screenerStatus: ScreenerDepositRequestStatus
): DepositRequestStatus {
  switch (subgraphStatus) {
    case GqlDepositRequestStatus.Retrieved:
      return "RETRIEVED";
    case GqlDepositRequestStatus.Completed:
      return "COMPLETE"; // ! TODO need access to logic to distinguish between FULFILLED and COMPLETE. COMPLETE if new note is committed in tree, FULFILLED otherwise
    default:
      break;
  }

  switch (screenerStatus) {
    case ScreenerDepositRequestStatus.DoesNotExist:
      return "DOES_NOT_EXIST";
    case ScreenerDepositRequestStatus.FailedScreen:
      return "FAILED_SCREEN";
    case ScreenerDepositRequestStatus.PassedFirstScreen:
      return "AWAITING_FULFILLMENT";
    case ScreenerDepositRequestStatus.AwaitingFulfillment:
      return "AWAITING_FULFILLMENT";
    case ScreenerDepositRequestStatus.Completed:
      return "COMPLETE";
    default:
      return "INITIATED";
  }
};

export async function fetchSubgraphDepositRequestsQuery(
  spender: string
): Promise<FetchDepositRequestsQuery> {
  const { data, error }: OperationResult<FetchDepositRequestsQuery> =
    await getUrqlClient()
      .query(DepositRequestsBySpenderQueryDocument, { spender })
      .toPromise();
  if (error || !data) {
    throw new Error(error?.message ?? "Deposit request query failed");
  }
  return data;
};
