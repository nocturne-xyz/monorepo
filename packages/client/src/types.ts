import { Address, Asset, CanonAddress, Operation } from "@nocturne-xyz/core";

export interface OptimisticNFRecord {
  nullifier: bigint;
}

export interface OptimisticOpDigestRecord {
  merkleIndices: number[];
  expirationDate: number;
  metadata?: OperationMetadata;
}

export interface OperationMetadata {
  items: OperationMetadataItem[];
}

export type OperationMetadataItem =
  | ConfidentialPaymentMetadata
  | ActionMetadata;

export type ActionMetadata =
  | {
      type: "Action";
      actionType: "Transfer";
      recipientAddress: Address;
      erc20Address: Address;
      amount: bigint;
    }
  | {
      type: "Action";
      actionType: "Weth To Wsteth";
      amount: bigint;
    }
  | {
      type: "Action";
      actionType: "Transfer ETH";
      recipientAddress: Address;
      amount: bigint;
    }
  | {
      type: "Action";
      actionType: "UniswapV3 Swap";
      tokenIn: Address;
      inAmount: bigint;
      tokenOut: Address;
    };

export interface ConfidentialPaymentMetadata {
  type: "ConfidentialPayment";
  recipient: CanonAddress;
  asset: Asset;
  amount: bigint;
}

export interface OpDigestWithMetadata {
  opDigest: bigint;
  metadata?: OperationMetadata;
}

export interface OperationWithMetadata<T extends Operation> {
  op: T;
  metadata?: OperationMetadata;
}
