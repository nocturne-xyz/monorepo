import React, { useState } from "react";
import { ABIItem, ABIValue } from "../utils/abiParser";
import { ethers } from "ethers";
import { Action } from "@nocturne-xyz/sdk";
import * as _ from "lodash";

type ABIInteractionFormProps = {
  abi: ABIItem[];
  contractAddress: string;
  handleAction: (action: Action) => void;
};

interface ABIInteractionFormData {
  [key: string]: ABIInteractionParamFormData[];
}

type ABIInteractionParamFormData =
  | string
  | { [key: string]: ABIInteractionParamFormData };

type ABIInteractionReturnValues = Record<string, string>;

function getInitialFormDataForInput(
  input: ABIValue
): ABIInteractionParamFormData {
  if (input.type === "tuple") {
    if (input.components === undefined)
      throw new Error("Tuple input type must have components");

    const res: ABIInteractionParamFormData = {};
    for (const component of input.components) {
      res[component.name] = getInitialFormDataForInput(component);
    }

    return res;
  } else {
    return "";
  }
}

export const ABIInteractionForm: React.FC<ABIInteractionFormProps> = ({
  abi,
  contractAddress,
  handleAction,
}) => {
  const initialFormData: ABIInteractionFormData = {};
  for (const method of abi.filter(({ type }) => type === "function")) {
    initialFormData[method.name] = method.inputs.map((input) =>
      getInitialFormDataForInput(input)
    );
  }

  const [formData, setFormData] =
    useState<ABIInteractionFormData>(initialFormData);
  const [returnValues, setReturnValues] = useState<ABIInteractionReturnValues>(
    {}
  );
  const iface = new ethers.utils.Interface(abi);

  const handleEnqueueAction = (
    event: React.FormEvent<HTMLFormElement>,
    methodName: string
  ) => {
    event.preventDefault();

    const inputs = formData[methodName];
    const encodedFunction = iface.encodeFunctionData(methodName, inputs);
    const action = {
      contractAddress,
      encodedFunction,
    };

    handleAction(action);
  };

  const formFields = abi
    .filter(({ type }) => type === "function")
    .map((method) => {
      const handleChangeAtIndex = (
        paramIndex: number,
        event: any,
        path: string[]
      ) => {
        const newFormData = _.cloneDeep(formData);

        const pathString = path.join(".");
        const fullPath =
          `${method.name}[${paramIndex}]` +
          (pathString.length > 0 ? `.${pathString}` : "");
        _.set(newFormData, fullPath, event.target.value);

        setFormData(newFormData);
      };

      return (
        <div key={method.name}>
          <h3>{method.name}</h3>
          {method.inputs.map((input, i) => (
            <ABIMethodParamInput
              key={i}
              param={input}
              value={formData[method.name][i]}
              handleChange={(param, path) =>
                handleChangeAtIndex(i, param, path)
              }
            />
          ))}

          <button
            type="submit"
            onClick={(event: any) => handleEnqueueAction(event, method.name)}
          >
            Enqueue Action
          </button>
          {returnValues[method.name] && (
            <div>Return value: returnValues[method.name]</div>
          )}
        </div>
      );
    });

  return <div>{formFields}</div>;
};

type ABIMethodParamInput = {
  param: ABIValue;
  value: ABIInteractionParamFormData;
  handleChange: (event: any, path: string[]) => void;
  path?: string[];
};

const ABIMethodParamInput = ({
  param,
  value,
  handleChange,
  path: _path,
}: ABIMethodParamInput) => {
  const path = _path ?? [];
  const pathStr = path.join(".");
  const curriedHandleChange = (event: any) => {
    handleChange(event, path);
  };

  switch (param.type) {
    case "tuple": {
      if (param.components === undefined) {
        throw new Error("Tuple type must have components");
      }

      if (typeof value !== "object") {
        throw new Error("Tuple type must have object value");
      }

      const tupleInputs = param.components.map((component, i) => (
        <ABIMethodParamInput
          key={i}
          param={component}
          path={[...path, component.name]}
          value={value[param.name]}
          handleChange={curriedHandleChange}
        />
      ));
      return (
        <div key={pathStr}>
          <label htmlFor={pathStr}>{param.name}</label>
          {tupleInputs}
        </div>
      );
    }

    default: {
      if (param.components !== undefined) {
        throw new Error("Non-tuple type must not have components");
      }

      if (typeof value !== "string") {
        throw new Error("Non-tuple type must have string value");
      }

      return (
        <div key={pathStr}>
          <label htmlFor={pathStr}>{param.name}</label>
          <input
            type="text"
            name={param.name}
            id={pathStr}
            value={value}
            onChange={curriedHandleChange}
          />
        </div>
      );
    }
  }
};
