import * as JSON from "bigint-json-serialization";
import { OperationWithMetadata } from "./types";
import {
  CanonAddrRegistryEntry,
  PreSignOperation,
  SignedOperation,
} from "@nocturne-xyz/core";
import {
  CanonAddress,
  NocturneSignature,
  SpendPk,
  ViewingKey,
} from "@nocturne-xyz/crypto";

export interface SetSpendKeyMethod {
  method: "nocturne_setSpendKey";
  params: {
    spendKey: Uint8Array;
  };
  return: string | undefined; // error string or undefined
}

export interface SignCanonAddrRegistryEntryMethod {
  method: "nocturne_signCanonAddrRegistryEntry";
  params: {
    entry: CanonAddrRegistryEntry;
    chainId: bigint;
    registryAddress: string;
  };
  return: {
    canonAddr: CanonAddress;
    digest: bigint;
    sig: NocturneSignature;
    spendPubkey: SpendPk;
    vkNonce: bigint;
  };
}

export interface SignOperationMethod {
  method: "nocturne_signOperation";
  params: OperationWithMetadata<PreSignOperation>;
  return: SignedOperation;
}

export interface SpendKeyIsSetMethod {
  method: "nocturne_spendKeyIsSet";
  params: undefined;
  return: boolean;
}

export interface RequestViewingKeyMethodResponse {
  vk: ViewingKey;
  vkNonce: bigint;
}

export interface RequestViewingKeyMethod {
  method: "nocturne_requestViewingKey";
  params: undefined;
  return: RequestViewingKeyMethodResponse;
}

export type RpcRequestMethod =
  | SetSpendKeyMethod
  | SignCanonAddrRegistryEntryMethod
  | SignOperationMethod
  | RequestViewingKeyMethod
  | SpendKeyIsSetMethod;

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
