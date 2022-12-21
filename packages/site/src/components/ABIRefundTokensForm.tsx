import { isAddress } from "ethers/lib/utils";
import React, { useState } from "react";

export interface ABIRefundTokensFormProps {
  handleNewRefundToken: (refundTokenAddress: string) => void;
}

export const ABIRefundTokensForm = ({
  handleNewRefundToken,
}: ABIRefundTokensFormProps) => {
  const [outputContractTokenAddress, setOutputContractTokenAddress] =
    useState("");

  const handleAddOutputToken = () => {
    if (isAddress(outputContractTokenAddress)) {
      handleNewRefundToken(outputContractTokenAddress);
    } else {
      alert("Invalid output token address");
    }
  };

  return (
    <div>
      <h3>Output Tokens</h3>

      <label>
        Output Contract Token Address:
        <input
          type="text"
          value={outputContractTokenAddress}
          onChange={(e) => setOutputContractTokenAddress(e.target.value)}
        />
      </label>
      <br />
      <button onClick={handleAddOutputToken}>Add Output Token</button>
    </div>
  );
};
