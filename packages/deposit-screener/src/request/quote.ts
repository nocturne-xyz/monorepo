import Ajv from "ajv";

const addressPattern = "^0x[a-fA-F0-9]{40}$";
const addressType = { type: "string", pattern: addressPattern };
const bigintPattern = "^[0-9]+n$";
const bigintType = { type: "string", pattern: bigintPattern };

const quoteRequestSchema = {
  type: "object",
  required: ["spender", "assetAddr", "value"],
  properties: {
    spender: addressType,
    assetAddr: addressType,
    value: bigintType,
  },
  additionalProperties: false,
};

const ajv = new Ajv();
export default ajv.compile(quoteRequestSchema);
