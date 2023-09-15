import { NocturneConfig } from "@nocturne-xyz/config";

import {
  AssetType,
  ClosableAsyncIterator,
  OperationMetadata,
  OperationStatusResponse,
} from "@nocturne-xyz/core";
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

export interface SyncWithProgressOutput {
  latestSyncedMerkleIndex: number;
  latestMerkleIndexOnChain: number;
  progressIter: ClosableAsyncIterator<SyncProgress>;
}

export interface NocturneSdkConfig {
  config: NocturneConfig;
  endpoints: Endpoints;
}

export type SupportedNetwork = "goerli" | "mainnet" | "localhost";

export interface GetBalanceOpts {
  includeUncommitted?: boolean;
  ignoreOptimisticNFs?: boolean;
}

export interface DepositHandleWithReceipt {
  receipt: ContractReceipt;
  handle: DepositHandle;
}

export enum DepositRequestStatus {
  // deposit has been initiated on-chain
  // and funds are in escrow, but
  // they still have yet to be moved
  // into the Teller by the screener.
  // user can "retrieve" the deposit
  // from escrow to "cancel" it and
  // get their money back
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
