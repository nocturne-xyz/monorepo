import React, { useState } from 'react';

export interface ContractABIMethod {
  name: string;
  inputs: {
    name: string;
    type: string;
  }[];
  outputs: {
    name: string;
    type: string;
  }[];
};

interface ABIFormProps {
  abi: string;
}

type ABIFormData = Record<string, string | number>;

type ABIOutputs = Record<string, any>;

const ABIForm: React.FC<ABIFormProps> = ({ abi }) => {
  // Parse the ABI string into an array of objects
  const methods: ContractABIMethod[] = JSON.parse(abi);

  // Use the useState hook to create a state variable for storing the form data
  const [formData, setFormData] = useState<ABIFormData>({});

  // Use the useState hook to create a state variable for storing the return values
  const [returnValues, setReturnValues] = useState<ABIOutputs>({});

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
  const formFields = methods.map((method) => {
    return (
      <div key={method.name}>
        <h3>{method.name}</h3>
        {method.inputs.map((input) => {
          return (
            <div key={input.name}>
              <label htmlFor={input.name}>{input.name}</label>
              <input
                type="text"
                id={input.name}
                name={input.name}
                value={formData[input.name] || ''}
                onChange={handleChange}
              />
            </div>
          );
        })}
        <button type="submit" onClick={(event) => handleSubmit(event, method.name)}>
          Submit
        </button>
        {returnValues[method.name] && (
          <div>
            Return value: {JSON.stringify(returnValues[method.name])}
          </div>
        )}
      </div>
    );
  });

  return <form>{formFields}</form>;
};

export default ABIForm;