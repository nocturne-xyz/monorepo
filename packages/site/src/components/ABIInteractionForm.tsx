import React, { useState } from 'react';
import { ABIItem, ABIValue } from '../utils/abiParser';

type ABIInteractionFormProps = {
  abi: ABIItem[];
}

interface ABIInteractionFormData {
  [key: string]: string | ABIInteractionFormData;
}

type ABIInteractionReturnValues = Record<string, string>;

export const ABIInteractionForm: React.FC<ABIInteractionFormProps> = ({ abi }) => {
  // Use the useState hook to create a state variable for storing the form data
  const [formData, setFormData] = useState<ABIInteractionFormData>({});

  // Use the useState hook to create a state variable for storing the return values
  const [returnValues, setReturnValues] = useState<ABIInteractionReturnValues>({});

  // Create a function for handling form submissions
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>, methodName: string) => {
    // Prevent the default form submission behavior
    event.preventDefault();

    // TODO: Call a function to send the transaction with the form data and set the return value in the state
    console.log("hi");
    // setReturnValues((returnValues) => ({ ...returnValues, [methodName]: returnValues }));
  };

  // Create a function for handling changes to the form fields
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((formData) => ({ ...formData, [name]: value }));
  };

  // Render the form fields for each method in the ABI
  const formFields = abi.filter(({ type }) => type === "function").map((method) => {
    return (
      <div key={method.name}>
        <h3>{method.name}</h3>
        {
          method.inputs.map((input) => <ABIMethodParamInput param={input} formData={formData} handleChange={handleChange} />)
        }
        
        <button type="submit" onClick={(event: any) => handleSubmit(event, method.name)}>
          Submit
        </button>
        {returnValues[method.name] && (
          <div>
            Return value: returnValues[method.name]
          </div>
        )}
      </div>
    );
  });

  return <form>{formFields}</form>;
};

type ABIMethodParamInput = {
  param: ABIValue;
  formData: ABIInteractionFormData;
  handleChange: (event: any, path: string[]) => void;
  path?: string[];
}

const ABIMethodParamInput = ({ param, formData, handleChange, path }: ABIMethodParamInput) => {
  path = path ?? [];
  path.push(param.name);
  const pathStr = path.join(".");
  const _handleChange = (event: any) => handleChange(event, path as string[]);


  switch (param.type) {
    case "tuple": {
      if (param.components === undefined) {
        throw new Error("Tuple type must have components");
      }

      if (formData[param.name] === undefined) {
        formData[param.name] = {};
      }

      if (typeof formData[param.name] !== "object") {
        throw new Error("Tuple type must have object value");
      }

      const tupleInputs = param.components.map(component => <ABIMethodParamInput param={component} formData={formData[param.name] as ABIInteractionFormData} handleChange={_handleChange} />);
      return (
        <div key={param.name}>
          <label htmlFor={pathStr}>{param.name}</label>
          {tupleInputs}
        </div>
      );
    }

    default: {
      if (param.components !== undefined) {
        throw new Error("Non-tuple type must not have components");
      }

      if (formData[param.name] === undefined) {
        formData[param.name] = "";
      }

      if (typeof formData[param.name] !== "string") {
        throw new Error("Non-tuple type must have string value");
      }

      return (
        <div key={param.name}>
          <label htmlFor={pathStr}>{param.name}</label>
          <input
            type="text"
            name={param.name}
            id={pathStr}
            value={formData[param.name] as string || ''}
            onChange={_handleChange}
          />
        </div>
      );
    }
  }
};
