import {
  Address,
  Asset,
  CanonAddress,
  Operation,
  OperationStatus,
} from "@nocturne-xyz/core";

export type OpWithMetadata<O> = {
  op: O;
  metadata: OperationMetadata;
};

export interface OptimisticNFRecord {
  nullifier: bigint;
  expirationDate: number;
}

export type OpHistoryRecord = {
  digest: bigint;
  metadata: OperationMetadata;

  spentNoteMerkleIndices: number[];

  status?: OperationStatus;

  createdAt: number;
  lastModified: number;
};

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
      maxSlippageBps: number;
      exactQuoteWei: bigint;
      minimumAmountOutWei: bigint;
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
