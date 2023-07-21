import Ajv from "ajv";

const bigintPattern = "^[0-9]+n$";
const addressPattern = "^0x[a-fA-F0-9]{40}$";
const booleanType = { type: "boolean" };
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
const encodedRefundAssetsType = {
  type: "array",
  items: encodedAssetType,
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
    "commitmentTreeRoot",
    "nullifierA",
    "nullifierB",
    "newNoteACommitment",
    "newNoteBCommitment",
    "encodedAsset",
    "publicSpend",
    "newNoteAEncrypted",
    "newNoteBEncrypted",
  ],
  properties: {
    proof: solidityProofType,
    senderCommitment: bigintType,
    commitmentTreeRoot: bigintType,
    nullifierA: bigintType,
    nullifierB: bigintType,
    newNoteACommitment: bigintType,
    newNoteBCommitment: bigintType,
    encodedAsset: encodedAssetType,
    publicSpend: bigintType,
    newNoteAEncrypted: encryptedNoteType,
    newNoteBEncrypted: encryptedNoteType,
  },
  additionalProperties: false,
};
const joinSplitsType = {
  type: "array",
  items: joinSplitType,
};

export const provenOperationType = {
  type: "object",
  required: [
    "networkInfo",
    "joinSplits",
    "refundAddr",
    "encodedRefundAssets",
    "actions",
    "encodedGasAsset",
    "gasAssetRefundThreshold",
    "executionGasLimit",
    "maxNumRefunds",
    "gasPrice",
    "deadline",
    "atomicActions",
  ],
  properties: {
    networkInfo: networkInfoType,
    joinSplits: joinSplitsType,
    refundAddr: stealthAddressType,
    encodedRefundAssets: encodedRefundAssetsType,
    actions: actionsType,
    encodedGasAsset: encodedAssetType,
    gasAssetRefundThreshold: bigintType,
    executionGasLimit: bigintType,
    maxNumRefunds: bigintType,
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
    operation: provenOperationType,
  },
  additionalProperties: false,
};

const ajv = new Ajv();
export default ajv.compile(relaySchema);
