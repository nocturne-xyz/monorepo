import Ajv from "ajv";

const bigintPattern = "^[0-9]+n$";
const addressPattern = "^0x[a-fA-F0-9]{40}$";
const bigintType = { type: "string", pattern: bigintPattern };
const addressType = { type: "string", pattern: addressPattern };
const solidityProofType = {
  type: "array",
  items: bigintType,
  minItems: 8,
  maxItems: 8,
};
const stealthAddressType = {
  type: "object",
  required: ["h1X", "h1Y", "h2X", "h2Y"],
  properties: {
    h1X: bigintType,
    h1Y: bigintType,
    h2X: bigintType,
    h2Y: bigintType,
  },
  additionalProperties: false,
};
const encryptedNoteType = {
  type: "object",
  required: ["owner", "encappedKey", "encryptedNonce", "encryptedValue"],
  properties: {
    owner: stealthAddressType,
    encappedKey: bigintType,
    encryptedNonce: bigintType,
    encryptedValue: bigintType,
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
const joinSplitTxType = {
  type: "object",
  required: [
    "proof",
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
const joinSplitTxsType = {
  type: "array",
  items: joinSplitTxType,
};

export const relaySchema = {
  type: "object",
  required: [
    "joinSplitTxs",
    "refundAddr",
    "encodedRefundAssets",
    "actions",
    "verificationGasLimit",
    "executionGasLimit",
    "maxNumRefunds",
    "gasPrice",
  ],
  properties: {
    joinSplitTxs: joinSplitTxsType,
    refundAddr: stealthAddressType,
    encodedRefundAssets: encodedRefundAssetsType,
    actions: actionsType,
    verificationGasLimit: bigintType,
    executionGasLimit: bigintType,
    maxNumRefunds: bigintType,
    gasPrice: bigintType,
  },
  additionalProperties: false,
};

const ajv = new Ajv();
export default ajv.compile(relaySchema);
