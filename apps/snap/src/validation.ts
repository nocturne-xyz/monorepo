import {
  object,
  define,
  string,
  bigint,
  array,
  boolean,
  enums,
  union,
} from "superstruct";

const Uint8ArrayType = define(
  "Uint8Array",
  (value: any): value is Uint8Array => {
    return value instanceof Uint8Array;
  }
);

export const SetSpendKeyParams = object({
  spendKey: Uint8ArrayType,
});

export const SignCanonAddrRegistryEntryParams = object({
  entry: object({
    ethAddress: string(),
    compressedCanonAddr: bigint(),
    perCanonAddrNonce: bigint(),
  }),
  chainId: bigint(),
  registryAddress: string(),
});

const NetworkInfoType = object({
  chainId: bigint(),
  tellerContract: string(),
});

const CompressedStealthAddressType = object({
  h1: bigint(),
  h2: bigint(),
});

const EncodedAssetType = object({
  encodedAssetAddr: bigint(),
  encodedAssetId: bigint(),
});

const TrackedAssetType = object({
  encodedAsset: EncodedAssetType,
  minRefundValue: bigint(),
});

const ActionType = object({
  contractAddress: string(),
  encodedFunction: string(),
});

const CanonAddressType = object({
  x: bigint(),
  y: bigint(),
});

const AssetTypeType = enums(["ERC20", "ERC721", "ERC1155"]);

const AssetType = object({
  assetType: AssetTypeType,
  assetAddr: string(),
  id: bigint(),
});

const PreSignOperationType = object({
  networkInfo: NetworkInfoType,
  refundAddr: CompressedStealthAddressType,
  refunds: array(TrackedAssetType),
  actions: array(ActionType),
  encodedGasAsset: EncodedAssetType,
  gasAssetRefundThreshold: bigint(),
  executionGasLimit: bigint(),
  gasPrice: bigint(),
  deadline: bigint(),
  atomicActions: boolean(),
});

// ConfidentialPaymentMetadata structure
const ConfidentialPaymentMetadata = object({
  type: enums(["ConfidentialPayment"]),
  recipient: CanonAddressType,
  asset: AssetType,
  amount: bigint(),
});

// ActionMetadata structures
const TransferAction = object({
  type: enums(["Action"]),
  actionType: enums(["Transfer"]),
  recipientAddress: string(),
  erc20Address: string(),
  amount: bigint(),
});

const WethToWstethAction = object({
  type: enums(["Action"]),
  actionType: enums(["Weth To Wsteth"]),
  amount: bigint(),
});

const TransferETHAction = object({
  type: enums(["Action"]),
  actionType: enums(["Transfer ETH"]),
  recipientAddress: string(),
  amount: bigint(),
});

const UniswapV3SwapAction = object({
  type: enums(["Action"]),
  actionType: enums(["UniswapV3 Swap"]),
  tokenIn: string(),
  inAmount: bigint(),
  tokenOut: string(),
});

// Union type for ActionMetadata
const ActionMetadataType = union([
  TransferAction,
  WethToWstethAction,
  TransferETHAction,
  UniswapV3SwapAction,
]);

// OperationMetadataItem union type
const OperationMetadataItem = union([
  ConfidentialPaymentMetadata,
  ActionMetadataType,
]);

// OperationMetadata structure
const OperationMetadataType = object({
  items: array(OperationMetadataItem),
});

export const SignOperationParams = object({
  op: PreSignOperationType,
  metadata: OperationMetadataType,
});

/*
export interface SignOperationMethod {
  method: "nocturne_signOperation";
  params:  {
    op: T;
    metadata?: OperationMetadata;
  }
  return: SignedOperation;
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
*/
