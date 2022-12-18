import Ajv from 'ajv';

export interface ABIItem {
  name: string;
  type: string;
  inputs: ABIValue[];
  outputs: ABIValue[];
};

export interface ABIValue {
  name: string;
  type: string;
  components?: ABIValue[];
}

const ajv = new Ajv();

const valueSchema = {
  type: 'object',
  required: ['name', 'type'],
  properties: {
    name: { type: 'string' },
    type: { type: 'string' },
    components: {
      type: 'array',
      items: { $ref: '#/definitions/value' },
    },
  },
  definitions: {
    value: { $ref: '#/definitions/value' },
  },
};

const itemSchema = {
  type: 'object',
  required: ['name', 'type', 'inputs', 'outputs'],
  properties: {
    name: { type: 'string' },
    type: { type: 'string' },
    inputs: {
      type: 'array',
      items: { $ref: '#/definitions/value' },
    },
    outputs: {
      type: 'array',
      items: { $ref: '#/definitions/value' },
    },
  },
  definitions: {
    value: valueSchema,
  },
};

const abiSchema = {
  type: 'array',
  items: { $ref: '#/definitions/item' },
  definitions: {
    item: itemSchema,
  },
};

const validate = ajv.compile(abiSchema);

export function tryParseABI(jsonStr: string): ABIItem[] | undefined {
  try {
    // Parse the text into a JSON object
    const data = JSON.parse(jsonStr);

    // Validate the data against the schema
    if (validate(data)) {
      // If the data is valid, return it as an array of ABIMethods
      return data as ABIItem[];
    } else {
      // If the data is invalid, return null
      return undefined;
    }
  } catch (error) {
    // If there was an error parsing or validating the data, return null
    return undefined;
  }
}
