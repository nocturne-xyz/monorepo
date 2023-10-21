import {
  string,
  bigint,
  number,
  array,
  boolean,
  enums,
  union,
  define,
  type,
} from "superstruct";

export const UndefinedType = define(
  "Undefined",
  (value) => value === undefined
);

// This is how Uint8Array is serialized when passed to snap
const isStringifiedUint8Array = (value: any) => {
  if (typeof value !== "object" || Array.isArray(value)) return false;

  const keys = Object.keys(value)
    .map((k) => parseInt(k, 10))
    .sort((a, b) => a - b);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== i) return false;
  }

  return true;
};

const StringifiedUint8ArrayType = define(
  `StringifiedUint8ArrayType`,
  isStringifiedUint8Array
);

export const SetSpendKeyParams = type({
  spendKey: StringifiedUint8ArrayType,
});

export const SignCanonAddrRegistryEntryParams = type({
  entry: type({
    ethAddress: string(),
    compressedCanonAddr: bigint(),
    perCanonAddrNonce: bigint(),
  }),
  chainId: bigint(),
  registryAddress: string(),
});

const NetworkInfoType = type({
  chainId: bigint(),
  tellerContract: string(),
});

const SteathAddressType = type({
  h1X: bigint(),
  h1Y: bigint(),
  h2X: bigint(),
  h2Y: bigint(),
});

const CompressedStealthAddressType = type({
  h1: bigint(),
  h2: bigint(),
});

const EncodedAssetType = type({
  encodedAssetAddr: bigint(),
  encodedAssetId: bigint(),
});

const TrackedAssetType = type({
  encodedAsset: EncodedAssetType,
  minRefundValue: bigint(),
});

const ActionType = type({
  contractAddress: string(),
  encodedFunction: string(),
});

const CanonAddressType = type({
  x: bigint(),
  y: bigint(),
});

const AssetTypeType = enums([0, 1, 2]);

const AssetType = type({
  assetType: AssetTypeType,
  assetAddr: string(),
  id: bigint(),
});

const EncryptedNoteType = type({
  ciphertextBytes: array(number()),
  encapsulatedSecretBytes: array(number()),
});

const NoteType = type({
  owner: SteathAddressType,
  nonce: bigint(),
  asset: AssetType,
  value: bigint(),
});

const IncludedNoteType = type({
  owner: SteathAddressType,
  nonce: bigint(),
  asset: AssetType,
  value: bigint(),
  merkleIndex: number(),
});

const MerkleProofInputType = type({
  path: array(bigint()),
  siblings: array(array(bigint())),
});

const PreSignJoinSplitType = type({
  commitmentTreeRoot: bigint(),
  nullifierA: bigint(),
  nullifierB: bigint(),
  newNoteACommitment: bigint(),
  newNoteBCommitment: bigint(),
  senderCommitment: bigint(),
  joinSplitInfoCommitment: bigint(),
  encodedAsset: EncodedAssetType,
  publicSpend: bigint(),
  newNoteAEncrypted: EncryptedNoteType,
  newNoteBEncrypted: EncryptedNoteType,
  receiver: CanonAddressType,
  oldNoteA: IncludedNoteType,
  oldNoteB: IncludedNoteType,
  newNoteA: NoteType,
  newNoteB: NoteType,
  merkleProofA: MerkleProofInputType,
  merkleProofB: MerkleProofInputType,
  refundAddr: CompressedStealthAddressType,
});

const PreSignOperationType = type({
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
  joinSplits: array(PreSignJoinSplitType),
});

const ConfidentialPaymentMetadataType = type({
  type: enums(["ConfidentialPayment"]),
  recipient: CanonAddressType,
  asset: AssetType,
  amount: bigint(),
});

const TransferActionMetadataType = type({
  type: enums(["Action"]),
  actionType: enums(["Transfer"]),
  recipientAddress: string(),
  erc20Address: string(),
  amount: bigint(),
});

const WethToWstethActionMetadataType = type({
  type: enums(["Action"]),
  actionType: enums(["Weth To Wsteth"]),
  amount: bigint(),
});

const TransferETHActionMetadataType = type({
  type: enums(["Action"]),
  actionType: enums(["Transfer ETH"]),
  recipientAddress: string(),
  amount: bigint(),
});

const UniswapV3SwapActionMetadataType = type({
  type: enums(["Action"]),
  actionType: enums(["UniswapV3 Swap"]),
  tokenIn: string(),
  inAmount: bigint(),
  tokenOut: string(),
});

const ActionMetadataType = union([
  TransferActionMetadataType,
  WethToWstethActionMetadataType,
  TransferETHActionMetadataType,
  UniswapV3SwapActionMetadataType,
]);

const OperationMetadataItemType = union([
  ConfidentialPaymentMetadataType,
  ActionMetadataType,
]);

const OperationMetadataType = type({
  items: array(OperationMetadataItemType),
});

export const SignOperationParams = type({
  op: PreSignOperationType,
  metadata: OperationMetadataType,
});
