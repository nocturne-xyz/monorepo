import {
  Address,
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
import * as JSON from "bigint-json-serialization";
import { OperationWithMetadata } from "./types";

export interface SetSpendKeyMethod {
  method: "nocturne_setSpendKey";
  params: {
    spendKey: string;
    eoaAddress: Address;
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

export interface RequestSpendKeyEoaMethod {
  method: "nocturne_requestSpendKeyEoa";
  params: undefined;
  return: Address | undefined;
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
  | RequestSpendKeyEoaMethod;

export type SnapRpcRequestHandlerArgs = {
  origin: string;
  request: RpcRequestMethod;
};

export type SnapRpcRequestHandler = (
  args: SnapRpcRequestHandlerArgs
) => Promise<RpcRequestMethod["return"]>;

export function assertAllRpcMethodsHandled(request: never): never {
  // @ts-expect-error on request.method—if this fires at runtime, we want to see the method name
  throw new Error("Snap JSON RPC method not handled: " + request.method);
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
