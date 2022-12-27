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
      // handles a change in the input form data for `method` for `paramIndex`th parameter
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

// recursive compoment that renders a nested form for a single ABI method param, which may be a struct
const ABIMethodParamInput = ({
  param,
  value,
  handleChange,
  path: _path,
}: ABIMethodParamInput) => {
  // "path" is the the path of the current field of the param (e.g. ["foo", "bar"] for the field "bar" of the struct param "foo")
  // this is needed to set the value of the field in the form data, which is one big objec
  const path = _path ?? [];
  const pathStr = path.join(".");
  const curriedHandleChange = (event: any) => {
    handleChange(event, path);
  };

  switch (param.type) {
    // it the param is a struct, recursively render each field
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

    // otherwise, render a single input field
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
