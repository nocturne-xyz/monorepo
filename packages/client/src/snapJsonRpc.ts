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
    spendKey: string; // converted to { '0': <number>, '1': <number>, '2': <number>, ... }
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
    Object.entries(params).map(([key, value]) => {
      const parsedValue = JSON.parse(value);
      if (parsedValue && parsedValue.__primitive) {
        return [key, parsedValue.value ?? undefined];
      } else {
        return [key, parsedValue];
      }
    })
  );
}

export function stringifyObjectValues(params: object): object {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      JSON.stringify(
        typeof value === "object"
          ? value
          : { __primitive: true, value: value ?? null }
      ),
    ])
  );
}
