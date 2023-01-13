import Ajv from "ajv";

export interface ABIItem {
  name: string;
  type: string;
  inputs: ABIValue[];
  outputs: ABIValue[];
}

export interface ABIValue {
  name: string;
  type: string;
  components?: ABIValue[];
}

const ajv = new Ajv();

const paramOrRetvalSchema = {
  $id: "value",
  type: "object",
  required: ["name", "type"],
  properties: {
    name: { type: "string" },
    type: { type: "string" },
    components: {
      type: "array",
      items: { $ref: "#" },
    },
  },
};

ajv.addSchema(paramOrRetvalSchema);

const methodSchema = {
  $id: "item",
  type: "object",
  required: ["name", "type", "inputs", "outputs"],
  properties: {
    name: { type: "string" },
    type: { type: "string" },
    inputs: {
      type: "array",
      items: { $ref: "#/definitions/value" },
    },
    outputs: {
      type: "array",
      items: { $ref: "#/definitions/value" },
    },
  },
  definitions: {
    value: paramOrRetvalSchema,
  },
};

ajv.addSchema(methodSchema);

const abiSchema = {
  type: "array",
  items: { $ref: "#/definitions/item" },
  definitions: {
    item: methodSchema,
  },
};

const validate = ajv.compile(abiSchema);

export function tryParseABI(jsonStr: string): ABIItem[] | undefined {
  try {
    // Parse the text into a JSON object
    let data = JSON.parse(jsonStr);

    //@ts-ignore
    data = data.filter((item) => item.type === "function");

    // Validate the data against the schema
    if (validate(data)) {
      // If the data is valid, return it as an array of ABIMethods
      return data as ABIItem[];
    } else {
      console.log(validate.errors);
      // If the data is invalid, return null
      return undefined;
    }
  } catch (error) {
    // If there was an error parsing or validating the data, return null
    return undefined;
  }
}
