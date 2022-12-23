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
const spendAndRefundTokensType = {
  type: "object",
  required: ["spendTokens", "refundTokens"],
  properties: {
    spendTokens: {
      type: "array",
      items: addressType,
    },
    refundTokens: {
      type: "array",
      items: addressType,
    },
  },
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
    "asset",
    "id",
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
    asset: addressType,
    id: bigintType,
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
  required: ["joinSplitTxs", "refundAddr", "tokens", "actions", "gasLimit"],
  properties: {
    joinSplitTxs: joinSplitTxsType,
    refundAddr: nocturneAddressType,
    tokens: spendAndRefundTokensType,
    actions: actionsType,
    gasLimit: bigintType,
  },
};

const ajv = new Ajv();
export default ajv.compile(relaySchema);
