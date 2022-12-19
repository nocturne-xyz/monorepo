import React, { useState } from 'react';
import { ABIInteractionForm } from "./ABIInteractionForm";
import { ABIItem, tryParseABI } from '../utils/abiParser';
import { Button } from './Buttons';

export type ABIFormProps = {
  children: React.ReactNode;
};

export const ABIForm = () => {
  const [text, setText] = useState('');
  const [abi, setABI] = useState<ABIItem[] | undefined>(undefined);

  const handleSubmit = (event: any) => {
    event.preventDefault();
    const data = tryParseABI(text);
    console.log(data);
    setABI(data);
  };

  return (
    <>
      <label>
        ABI:
        <textarea value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <Button onClick={handleSubmit}>Set ABI</Button> 
      {abi ? <ABIInteractionForm abi={abi}/> : <></>}
    </>
  );
};
