import { Asset, CanonAddress, Operation } from "@nocturne-xyz/core";

export interface OptimisticNFRecord {
  nullifier: bigint;
}

export interface OptimisticOpDigestRecord {
  merkleIndices: number[];
  expirationDate: number;
  metadata?: OperationMetadata;
}

// metadata describing what an operation does
export interface OperationMetadata {
  items: OperationMetadataItem[];
}

// an operation can do two things (as many times as it wants):
// 1. confidential payments via joinsplit
// 2. actions
// they will be rendered in the UI in the order they appear in the array, listing first the summaries in order
// and then longer descriptions of each item below
export type OperationMetadataItem = {
  type: "ConfidentialPayment" | "Action";
  metadata: ConfidentialPaymentMetadata | ActionMetadata;
};

// metadata describing an arbitrary action
export type ActionMetadata = {
  // a brief description of the action in plain english
  // prefer language of the form "[verb] [direct object] [indirect object]"
  // e.g. "Transfer 2 ETH to Alice" or "Swap 1 ETH for 100 DAI"
  summary: string;

  // info about the plugin that created this action
  pluginInfo: {
    // e.g. "Erc20Plugin"
    name: string;

    // a link to the source code of the plugin (npm or github)
    // optional, but strongly recommended
    source?: string;
  };

  // details about the action (contracts being interacted with, swap path, etc).
  // optional, but strongly recommended
  details?: Record<string, string>;
};

export interface ConfidentialPaymentMetadata {
  displayAsset: string;
  displayAmount: string;
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
