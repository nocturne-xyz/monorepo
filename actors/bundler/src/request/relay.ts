import Ajv from "ajv";

const bigintPattern = "^[0-9]+n$";
const addressPattern = "^0x[a-fA-F0-9]{40}$";
const booleanType = { type: "boolean" };
const numberType = { type: "number" };
const bigintType = { type: "string", pattern: bigintPattern };
const addressType = { type: "string", pattern: addressPattern };
const byteArrayType = {
  type: "array",
  items: {
    type: "integer",
    minimum: 0,
    maximum: 255,
  },
  minItems: 0,
};
const networkInfoType = {
  type: "object",
  required: ["chainId", "tellerContract"],
  properties: {
    chainId: bigintType,
    tellerContract: addressType,
  },
};
const solidityProofType = {
  type: "array",
  items: bigintType,
  minItems: 8,
  maxItems: 8,
};
const stealthAddressType = {
  type: "object",
  required: ["h1", "h2"],
  properties: {
    h1: bigintType,
    h2: bigintType,
  },
};
const encryptedNoteType = {
  type: "object",
  required: ["ciphertextBytes", "encapsulatedSecretBytes"],
  properties: {
    ciphertextBytes: byteArrayType,
    encapsulatedSecretBytes: byteArrayType,
  },
  additionalProperties: false,
};
const encodedAssetType = {
  type: "object",
  required: ["encodedAssetAddr", "encodedAssetId"],
  properties: {
    encodedAssetAddr: bigintType,
    encodedAssetId: bigintType,
  },
  additionalProperties: false,
};
const trackedAssetType = {
  type: "object",
  required: ["encodedAsset", "minRefundValue"],
  properties: {
    encodedAsset: encodedAssetType,
    minRefundValue: bigintType,
  },
  additionalProperties: false,
};
const trackedAssetsArrayType = {
  type: "array",
  items: trackedAssetType,
};
const actionType = {
  type: "object",
  required: ["contractAddress", "encodedFunction"],
  properties: {
    contractAddress: addressType,
    encodedFunction: {
      type: "string",
    },
  },
  additionalProperties: false,
};
const actionsType = {
  type: "array",
  items: actionType,
};
const joinSplitType = {
  type: "object",
  required: [
    "proof",
    "senderCommitment",
    "joinSplitInfoCommitment",
    "commitmentTreeRoot",
    "nullifierA",
    "nullifierB",
    "newNoteACommitment",
    "newNoteBCommitment",
    "newNoteAEncrypted",
    "newNoteBEncrypted",
  ],
  properties: {
    proof: solidityProofType,
    senderCommitment: bigintType,
    joinSplitInfoCommitment: bigintType,
    commitmentTreeRoot: bigintType,
    nullifierA: bigintType,
    nullifierB: bigintType,
    newNoteACommitment: bigintType,
    newNoteBCommitment: bigintType,
    newNoteAEncrypted: encryptedNoteType,
    newNoteBEncrypted: encryptedNoteType,
  },
  additionalProperties: false,
};
const joinSplitsType = {
  type: "array",
  items: joinSplitType,
};

const publicJoinSplitType = {
  type: "object",
  required: ["joinSplit", "assetIndex", "publicSpend"],
  properties: {
    joinSplit: joinSplitType,
    assetIndex: numberType,
    publicSpend: bigintType,
  },
  additionalProperties: false,
};
const publicJoinSplitsType = {
  type: "array",
  items: publicJoinSplitType,
};

export const submittableOperationType = {
  type: "object",
  required: [
    "networkInfo",
    "pubJoinSplits",
    "confJoinSplits",
    "refundAddr",
    "trackedAssets",
    "actions",
    "encodedGasAsset",
    "gasAssetRefundThreshold",
    "executionGasLimit",
    "gasPrice",
    "deadline",
    "atomicActions",
  ],
  properties: {
    networkInfo: networkInfoType,
    pubJoinSplits: publicJoinSplitsType,
    confJoinSplits: joinSplitsType,
    refundAddr: stealthAddressType,
    trackedAssets: trackedAssetsArrayType,
    actions: actionsType,
    encodedGasAsset: encodedAssetType,
    gasAssetRefundThreshold: bigintType,
    executionGasLimit: bigintType,
    gasPrice: bigintType,
    deadline: bigintType,
    atomicActions: booleanType,
  },
  additionalProperties: false,
};

const relaySchema = {
  type: "object",
  required: ["operation"],
  properties: {
    operation: submittableOperationType,
  },
  additionalProperties: false,
};

const ajv = new Ajv();
export default ajv.compile(relaySchema);
