import { ethers } from "ethers";
import { CanonAddress, StealthAddress } from "../crypto";
import { Action, Address, Asset, OperationMetadata } from "../primitives";

const ONE_DAY_SECONDS = 24 * 60 * 60;

// A joinsplit request is an unwrapRequest plus an optional payment
export interface JoinSplitRequest {
  asset: Asset;
  unwrapValue: bigint;
  payment?: ConfidentialPayment;
}

export type UnwrapRequest = Omit<JoinSplitRequest, "payment">;

export interface ConfidentialPaymentRequest extends ConfidentialPayment {
  asset: Asset;
}

export interface OperationRequest {
  joinSplitRequests: JoinSplitRequest[];
  refundAssets: Asset[];
  actions: Action[];
  chainId: bigint;
  tellerContract: Address;
  deadline: bigint;
  refundAddr?: StealthAddress;
  executionGasLimit?: bigint;
  gasPrice?: bigint;
}

export interface OperationRequestWithMetadata {
  request: OperationRequest;
  meta: OperationMetadata;
}

export interface GasAccountedOperationRequest
  extends Omit<OperationRequest, "executionGasLimit" | "gasPrice"> {
  gasAssetRefundThreshold: bigint;
  executionGasLimit: bigint;
  gasPrice: bigint;
  gasAsset: Asset;
}

export interface OperationGasParams {
  executionGasLimit: bigint;
  gasPrice?: bigint;
}

export interface ConfidentialPayment {
  value: bigint;
  receiver: CanonAddress;
}

export async function ensureOpRequestChainInfo(
  opRequest: OperationRequest,
  provider: ethers.providers.Provider
): Promise<OperationRequest> {
  if (opRequest.chainId === 0n) {
    const chainId = BigInt((await provider.getNetwork()).chainId);
    opRequest.chainId = chainId;
  }

  if (opRequest.deadline === 0n) {
    const deadline = BigInt(
      (await provider.getBlock("latest")).timestamp + ONE_DAY_SECONDS
    );
    opRequest.deadline = deadline;
  }

  return opRequest;
}
