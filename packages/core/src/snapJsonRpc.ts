import * as JSON from "bigint-json-serialization";
import {
  OperationWithMetadata,
  PreSignOperation,
  SignedOperation,
} from "./primitives";
import { ViewingKey } from "./crypto";
import { CanonAddrSigCheckInputs } from "./proof";

export interface SignOperationMethod {
  method: "nocturne_signOperation";
  params: OperationWithMetadata<PreSignOperation>;
  return: SignedOperation;
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

export interface GetCanonAddrSigCheckProofInputsParams {
  nonce: bigint;
}

export interface GetCanonAddrSigCheckProofInputsMethod {
  method: "nocturne_getCanonAddrSigCheckProofInputs";
  params: GetCanonAddrSigCheckProofInputsParams;
  return: CanonAddrSigCheckInputs;
}

export type RpcRequestMethod =
  | SignOperationMethod
  | RequestViewingKeyMethod
  | GetCanonAddrSigCheckProofInputsMethod;

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
