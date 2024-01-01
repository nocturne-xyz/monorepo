import { OperationMetadata } from "@nocturne-xyz/client";
import { NocturneConfig } from "@nocturne-xyz/config";
import { AssetType, OperationStatusResponse } from "@nocturne-xyz/core";
import { AnonErc20SwapQuote } from "@nocturne-xyz/op-request-plugins";
import { BigNumber, ContractReceipt, ethers } from "ethers";

export interface Endpoints {
  screenerEndpoint: string;
  bundlerEndpoint: string;
  subgraphEndpoint: string;
}

export interface ContractAddresses {
  depositManagerAddress: string;
  handlerAddress: string;
}

export interface SyncProgress {
  latestSyncedMerkleIndex: number;
}

export interface NocturneSdkConfig {
  config: NocturneConfig;
  endpoints: Endpoints;
}

export type SupportedNetwork = "goerli" | "mainnet" | "localhost";

export interface DepositHandleWithReceipt {
  receipt: ContractReceipt;
  handle: DepositHandle;
}

export enum OnChainDepositRequestStatus {
  Completed = "Completed",
  Pending = "Pending",
  Retrieved = "Retrieved",
}

export function parseOnChainDepositRequestStatus(
  status: string,
): OnChainDepositRequestStatus {
  switch (status) {
    case "Completed":
      return OnChainDepositRequestStatus.Completed;
    case "Pending":
      return OnChainDepositRequestStatus.Pending;
    case "Retrieved":
      return OnChainDepositRequestStatus.Retrieved;
    default:
      throw new Error(`Invalid OnChainDepositRequestStatus: ${status}`);
  }
}

export enum DepositRequestStatus {
  // deposit has been initiated on-chain
  // and funds are in escrow, but
  // they still have yet to be moved
  // into the Teller by the screener.
  // user can "retrieve" the deposit
  // from escrow to "cancel" it and
  // get their money back
  // if the deposit has not yet been picked up by the scerener
  // it is in the "INITIATED" state
  // if the deposit has been picked up by the screener and
  // the screener immediately rejected it,
  // then it is in the "FAILED_SCREEN" state
  // otherwise, it is in the "AWAITING_FULFILLMENT" state
  Initiated = "INITIATED",
  FailedScreen = "FAILED_SCREEN",
  AwaitingFulfillment = "AWAITING_FULFILLMENT",

  // user has "cancelled" their deposit
  // by "retrieving" it from escrow
  Retrieved = "RETRIEVED",

  // screener has moved the deposit
  // into the teller, but the commitment
  // tree hasn't been updated yet,
  // so the funds aren't yet spendable.
  // the user can no longer retrieve their
  // deposit from escrow
  Fulfilled = "FULFILLED",

  // the commitment tree has been updated
  // and the deposited funds are spendable
  Complete = "COMPLETE",
}

export interface DepositRequestStatusWithMetadata {
  status: DepositRequestStatus;
  estimatedWaitSeconds?: number;
}

export interface DepositHandle {
  depositRequestHash: string;
  request: DisplayDepositRequestWithMetadata;
  currentStatus: DepositRequestStatusWithMetadata;
  getStatus: () => Promise<DepositRequestStatusWithMetadata>;
}

export interface OperationHandle {
  digest: bigint;
  getStatus: () => Promise<OperationStatusResponse>;
  metadata?: OperationMetadata;
}

export interface TokenDetails {
  decimals: number;
  symbol: string;
}

export type SupportedProvider =
  | ethers.providers.JsonRpcProvider
  | ethers.providers.Web3Provider;

// *** CONVERTED TYPES *** //

export interface ConvertedAsset {
  assetType: AssetType;
  assetAddr: string;
  id: BigNumber;
}
export interface ConvertedCompressedStealthAddress {
  h1: BigNumber;
  h2: BigNumber;
}
export interface DisplayDepositRequest {
  spender: string;
  asset: ConvertedAsset;
  value: BigNumber;
  depositAddr: ConvertedCompressedStealthAddress;
  nonce: BigNumber;
  gasCompensation: BigNumber;
}

export interface DisplayDepositRequestWithMetadata
  extends DisplayDepositRequest {
  createdAtBlock?: number;
  txHashInstantiated?: string;
  txHashCompleted?: string;
  txHashRetrieved?: string;
}

// *** REQUEST TYPES *** //

// TODO
export interface GetBalanceOpts {
  // include notes that have been created
  // on-chain but not yet inserted into the
  // commitment tree
  // defaults to `false`
  includeUncommitted?: boolean;

  // include notes that being spent
  // by operations that have been signed / proven
  // by the SDK but may not have been submitted
  // on-chain by a bundler yet
  // defaults to `true`
  includePending?: boolean;
}

export type SelectedBatchPreference = "FAST" | "MEDIUM" | "SLOW";
export type PrepareOperationOpts =
  | {
      batchPreference: SelectedBatchPreference;
      eoaProvidesGas?: false;
    }
  | {
      batchPreference?: undefined;
      eoaProvidesGas: true;
    };

export interface AnonSwapRequestParams {
  tokenIn: string;
  amountIn: bigint;
  tokenOut: string;
  protocol?: "UNISWAP_V3";
  maxSlippageBps?: number;
}

export interface DisplayDepositRequestWithMetadataAndStatus
  extends DisplayDepositRequestWithMetadata {
  onChainStatus?: OnChainDepositRequestStatus;
}

export type AnonErc20SwapQuoteResponse =
  | {
      success: true;
      quote: AnonErc20SwapQuote;
    }
  | {
      success: false;
      message: string;
    };
