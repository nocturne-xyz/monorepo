import { AssetType, AssetTrait } from "@nocturne-xyz/sdk";
import React, { useState } from "react";
import { Button } from "./Buttons";
import { isAddress } from "ethers/lib/utils";
import { NocturneFrontendSDK } from "../sdk";
import { getTokenDetails, formatTokenAmountEvmRepr } from "../utils";

export interface DepositFormProps {
  sdk: NocturneFrontendSDK;
}

export const DepositForm = ({ sdk }: DepositFormProps) => {
  const [assetType, setAssetType] = useState<AssetType>(AssetType.ERC20);
  const [assetAddress, setAssetAddress] = useState("");
  const [amount, setAmount] = useState("0");
  const [assetID, setAssetID] = useState("0");

  const handleAssetTypeChange = (event: any) => {
    setAssetType(AssetTrait.parseAssetType(event.target.value));
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
    if (!isAddress(assetAddress)) {
      alert("Invalid asset address");
      return;
    }

    let id;
    try {
      id = BigInt(assetID);
    } catch {
      alert("Invalid asset ID");
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
      assetType,
      assetAddress,
      sdk.walletContract.provider
    );
    const tokenUnitsValue = formatTokenAmountEvmRepr(value, decimals);

    await sdk.depositFunds(assetType, assetAddress, id, tokenUnitsValue);
  };

  return (
    <div>
      <div>
        <label>
          Asset Type
          <br />
          <select value={assetType} onChange={handleAssetTypeChange}>
            <option value={AssetType.ERC20.toString()}>ERC20</option>
            <option value={AssetType.ERC721.toString()}>ERC721</option>
            <option value={AssetType.ERC1155.toString()}>ERC1155</option>
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
            disabled={assetType === AssetType.ERC721}
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
            disabled={assetType === AssetType.ERC20}
          />
        </label>
        <br /> <br />
        <Button onClick={() => handleDepositFunds()}>Deposit Funds</Button>
      </div>
    </div>
  );
};
