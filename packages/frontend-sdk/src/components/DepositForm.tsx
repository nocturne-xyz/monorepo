import { AssetTrait } from "@nocturne-xyz/sdk";
import React, { useState } from "react";
import { Button } from "./Buttons";
import { isAddress } from "ethers/lib/utils";
import { NocturneFrontendSDK } from "../sdk";
import { getTokenDetails, formatTokenAmountEvmRepr } from "../utils";

export interface DepositFormProps {
  sdk: NocturneFrontendSDK;
}

export const DepositForm = ({ sdk }: DepositFormProps) => {
  const [assetType, setAssetType] = useState("");
  const [assetAddress, setAssetAddress] = useState("");
  const [amount, setAmount] = useState("0");
  const [assetID, setAssetID] = useState("0");

  const handleAssetTypeChange = (event: any) => {
    setAssetType(event.target.value);
  };

  const handleAssetIDChange = (event: any) => {
    const assetID = event.target.value;
    setAssetID(assetID);
  };

  const handleAmountChange = (event: any) => {
    const amount = event.target.value;
    setAmount(amount);
  };

  const handleDepositFunds = async () => {
    if (assetType === "ETH") {
      let value;
      try {
        value = Number(amount);
      } catch {
        alert("Invalid amount");
        return;
      }

      const tokenUnitsValue = formatTokenAmountEvmRepr(value, 18);
      await sdk.instantiateETHDeposits([tokenUnitsValue], 0n);
    } else {
      if (!isAddress(assetAddress)) {
        alert("Invalid asset address");
        return;
      }

      let value;
      try {
        value = Number(amount);
      } catch {
        alert("Invalid amount");
        return;
      }

      const { decimals } = await getTokenDetails(
        AssetTrait.parseAssetType(assetType),
        assetAddress,
        sdk.depositManagerContract.provider
      );
      const tokenUnitsValue = formatTokenAmountEvmRepr(value, decimals);

      await sdk.instantiateErc20Deposits(assetAddress, [tokenUnitsValue], 0n);
    }
  };

  return (
    <div>
      <div>
        <label>
          Asset Type
          <br />
          <select value={assetType} onChange={handleAssetTypeChange}>
            <option value={"ETH"}>ETH</option>
            <option value={"0"}>ERC20</option>
            <option value={"1"}>ERC721</option>
            <option value={"2"}>ERC1155</option>
          </select>
        </label>
        <br />
        <label>
          Contract Address
          <br />
          <textarea
            style={{ resize: "none", width: "70%", height: "30px" }}
            value={assetAddress}
            onChange={(event) => setAssetAddress(event.target.value)}
            disabled={assetType === "ETH"}
          />
        </label>
        <br />
        <label>
          Amount
          <br />
          <input
            type="number"
            value={amount}
            onChange={handleAmountChange}
            disabled={assetType === "ERC721"}
          />
        </label>
        <br />
        <label>
          Asset ID
          <br />
          <input
            type="text"
            value={assetID.toString()}
            onChange={handleAssetIDChange}
            disabled={assetType === "ERC20"}
          />
        </label>
        <br /> <br />
        <Button onClick={() => handleDepositFunds()}>Deposit Funds</Button>
      </div>
    </div>
  );
};
