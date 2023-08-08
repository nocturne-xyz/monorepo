import { NocturneConfig } from "@nocturne-xyz/config";

import {
  ClosableAsyncIterator,
  DepositRequest,
  DepositStatusResponse,
  OperationMetadata,
  OperationRequest,
  OperationStatusResponse,
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
  depositRequestHash: string;
  request: DepositRequest;
  getStatus: () => Promise<DepositStatusResponse>;
}

export interface OperationHandle {
  digest: bigint;
  getStatus: () => Promise<OperationStatusResponse>;
  metadata?: OperationMetadata;
}

export interface OperationRequestWithMetadata {
  request: OperationRequest;
  meta: OperationMetadata;
}
