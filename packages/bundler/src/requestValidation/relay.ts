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
const nocturneAddressType = {
  type: "object",
  required: ["h1X", "h1Y", "h2X", "h2Y"],
  properties: {
    h1X: bigintType,
    h1Y: bigintType,
    h2X: bigintType,
    h2Y: bigintType,
  },
};
const noteTransmissionType = {
  type: "object",
  required: ["owner", "encappedKey", "encryptedNonce", "encryptedValue"],
  properties: {
    owner: nocturneAddressType,
    encappedKey: bigintType,
    encryptedNonce: bigintType,
    encryptedValue: bigintType,
  },
};
const encodedAssetType = {
  type: "object",
  required: ["encodedAddr", "encodedId"],
  properties: {
    encodedAddr: bigintType,
    encodedId: bigintType,
  },
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
    "encodedAddr",
    "encodedId",
    "publicSpend",
    "newNoteATransmission",
    "newNoteBTransmission",
  ],
  properties: {
    proof: solidityProofType,
    commitmentTreeRoot: bigintType,
    nullifierA: bigintType,
    nullifierB: bigintType,
    newNoteACommitment: bigintType,
    newNoteBCommitment: bigintType,
    encodedAddr: bigintType,
    encodedId: bigintType,
    publicSpend: bigintType,
    newNoteATransmission: noteTransmissionType,
    newNoteBTransmission: noteTransmissionType,
  },
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
    "gasLimit",
    "gasPrice",
    "maxNumRefunds",
  ],
  properties: {
    joinSplitTxs: joinSplitTxsType,
    refundAddr: nocturneAddressType,
    encodedRefundAssets: encodedRefundAssetsType,
    actions: actionsType,
    gasLimit: bigintType,
    gasPrice: bigintType,
    maxNumRefunds: bigintType,
  },
};

const ajv = new Ajv();
export default ajv.compile(relaySchema);
