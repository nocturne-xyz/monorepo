import React, { useState } from 'react';
import { ABIInteractionForm } from "./ABIInteractionForm";
import { ABIItem, tryParseABI } from '../utils/abiParser';

type ABIFormProps = {
  children: React.ReactNode;
};

export const ABIForm = () => {
  const [text, setText] = useState('');
  const [abi, setABI] = useState<ABIItem[] | undefined>(undefined);

  const handleSubmit = (event: any) => {
    event.preventDefault();
    const data = tryParseABI(text);
    setABI(data);
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <label>
          Text:
          <input type="text" value={text} onChange={(event) => setText(event.target.value)} />
        </label>
        <input type="submit" value="Submit" />
      </form>
      {abi && <ABIInteractionForm abi={abi} />}
    </>
  );
};
