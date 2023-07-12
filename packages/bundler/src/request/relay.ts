import Ajv from "ajv";

const bigintPattern = "^[0-9]+n$";
const addressPattern = "^0x[a-fA-F0-9]{40}$";
const booleanType = { type: "boolean" };
const bigintType = { type: "string", pattern: bigintPattern };
const addressType = { type: "string", pattern: addressPattern };
// I don't know how complete this is, but it's probably good enough
const uint8ArrayType = {
  type: "object",
  patternProperties: {
    "^d+$": { type: "number" },
  },
  additionalProperties: false,
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
    ciphertextBytes: uint8ArrayType,
    encapsulatedSecretBytes: uint8ArrayType,
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
    "joinSplits",
    "refundAddr",
    "encodedRefundAssets",
    "actions",
    "encodedGasAsset",
    "gasAssetRefundThreshold",
    "executionGasLimit",
    "maxNumRefunds",
    "gasPrice",
    "chainId",
    "deadline",
    "atomicActions",
  ],
  properties: {
    joinSplits: joinSplitsType,
    refundAddr: stealthAddressType,
    encodedRefundAssets: encodedRefundAssetsType,
    actions: actionsType,
    encodedGasAsset: encodedAssetType,
    gasAssetRefundThreshold: bigintType,
    executionGasLimit: bigintType,
    maxNumRefunds: bigintType,
    gasPrice: bigintType,
    chainId: bigintType,
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
