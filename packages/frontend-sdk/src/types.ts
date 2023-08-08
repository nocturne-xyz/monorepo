import { NocturneConfig } from "@nocturne-xyz/config";

import {
  ClosableAsyncIterator,
  DepositRequest,
  DepositRequestStatus,
  OperationMetadata,
  OperationStatus,
} from "@nocturne-xyz/sdk";
import { ContractTransaction } from "ethers";

export type BundlerOperationID = string;

export interface Endpoints {
  screenerEndpoint: string;
  bundlerEndpoint: string;
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

export type SupportedNetwork = "sepolia" | "mainnet" | "localnet";

export interface GetBalanceOpts {
  includeUncommitted: boolean;
  ignoreOptimisticNFs: boolean;
}

export interface InitiateDepositResult {
  tx: ContractTransaction;
  handle: DepositHandle;
}

export interface DepositHandle {
  hash: string;
  request: DepositRequest;
  getStatus: () => Promise<DepositRequestStatus>;
}

export interface OperationHandle {
  digest: bigint;
  metadata: OperationMetadata;
  getStatus: () => Promise<OperationStatus>;
}
