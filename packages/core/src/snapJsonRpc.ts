import * as JSON from "bigint-json-serialization";
import { GetNotesOpts } from "./NocturneDB";
import { StealthAddress } from "./crypto";
import { OperationRequestWithMetadata } from "./operationRequest";
import {
  Asset,
  AssetWithBalance,
  OpDigestWithMetadata,
  SignedOperation,
} from "./primitives";
import { SyncOpts } from "./syncSDK";

export type LatestSyncedMerkleIndex = number | undefined;

export interface GetAllBalancesParams {
  opts?: GetNotesOpts;
}
export interface GetBalanceForAssetParams {
  opts?: GetNotesOpts;
  asset: Asset;
}
export interface SyncParams {
  opts?: SyncOpts;
}
type SignOperationParams = OperationRequestWithMetadata;

export interface GetAllBalancesMethod {
  method: "nocturne_getAllBalances";
  params: GetAllBalancesParams;
  return: AssetWithBalance[];
}

export interface GetBalanceForAssetMethod {
  method: "nocturne_getBalanceForAsset";
  params: GetBalanceForAssetParams;
  return: bigint;
}
export interface SyncMethod {
  method: "nocturne_sync";
  params: SyncParams;
  return: LatestSyncedMerkleIndex;
}

export interface SignOperationMethod {
  method: "nocturne_signOperation";
  params: SignOperationParams;
  return: SignedOperation;
}

export interface GetRandomizedAddrMethod {
  method: "nocturne_getRandomizedAddr";
  params?: undefined;
  return: StealthAddress;
}

export interface GetLatestSyncedMerkleIndexMethod {
  method: "nocturne_getLatestSyncedMerkleIndex";
  params?: undefined;
  return: LatestSyncedMerkleIndex;
}

export interface GetInFlightOperationsMethod {
  method: "nocturne_getInFlightOperations";
  params?: undefined;
  return: OpDigestWithMetadata[];
}

export interface ClearDbMethod {
  method: "nocturne_clearDb";
  params?: undefined;
  return: undefined;
}

export type RpcRequestMethod =
  | GetAllBalancesMethod
  | GetBalanceForAssetMethod
  | SyncMethod
  | SignOperationMethod
  | GetRandomizedAddrMethod
  | GetLatestSyncedMerkleIndexMethod
  | GetInFlightOperationsMethod
  | ClearDbMethod;

export type SnapRpcRequestHandlerArgs = {
  origin: string;
  request: RpcRequestMethod;
};

export type SnapRpcRequestHandler = (
  args: SnapRpcRequestHandlerArgs
) => Promise<RpcRequestMethod["return"]>;

export function assertAllRpcMethodsHandled(request: never): never {
  throw new Error("Snap JSON RPC method not handled: " + request);
}

export function parseObjectValues(params: object): object {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      typeof value === "string" ? JSON.parse(value) : value,
    ])
  );
}

export function stringifyObjectValues(params: object): object {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      typeof value === "object" ? JSON.stringify(value) : value,
    ])
  );
}
