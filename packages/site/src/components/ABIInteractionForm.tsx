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

export const ABIInteractionForm: React.FC<ABIInteractionFormProps> = ({
  abi,
  contractAddress,
  handleAction,
}) => {
  const iface = new ethers.utils.Interface(abi);

  const handleEnqueueAction = (
    encodedFunction: string 
  ) => {
    const action = {
      contractAddress,
      encodedFunction,
    };

    handleAction(action);
  };

  const formFields = abi
    .filter(({ type }) => type === "function")
    .map((method, i) => (
      <ABIMethod
        key={i}
        iface={iface}
        method={method}
        handleEnqueueAction={handleEnqueueAction}
      />
    ));

  return <div>{formFields}</div>;
};

type ABIMethodProps = {
  iface: ethers.utils.Interface;
  method: ABIItem;
  handleEnqueueAction: (encodedFunction: string) => void;
};

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

const ABIMethod = ({ iface, method, handleEnqueueAction }: ABIMethodProps) => {
  const initialFormData: ABIInteractionParamFormData[] = method.inputs.map(
    input => getInitialFormDataForInput(input)
  );
  const [inputs, setInputs] = useState<ABIInteractionParamFormData[]>(initialFormData);
  const handleChangeAtIndex = (
    paramIndex: number,
    value: any,
    path: string[]
  ) => {
    const newInputs = _.cloneDeep(inputs);

    const pathString = path.join(".");
    const fullPath = `[${paramIndex}]` + (pathString.length > 0 ? `.${pathString}` : "");
    _.set(newInputs, fullPath, value);

    console.log(newInputs);

    setInputs(newInputs);
  };

  const _handleEnqueueAction = (event: any) => {
    event.preventDefault();
    const encodedFunction = iface.encodeFunctionData(
      method.name,
      inputs
    );

    handleEnqueueAction(encodedFunction);
  };

  return (
    <div key={method.name}>
      <h3>{method.name}</h3>

      {method.inputs.map((input, i) => (
        <ABIMethodParamInput
          key={i}
          param={input}
          value={inputs[i]}
          handleChange={(param, path) =>
            handleChangeAtIndex(i, param, path)
          }
        />
      ))}

      <button
        type="submit"
        onClick={_handleEnqueueAction}
      >
        Enqueue Action
      </button>
    </div>
  );

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
    handleChange(event.target.value, path);
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

      console.log("value", value);
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
