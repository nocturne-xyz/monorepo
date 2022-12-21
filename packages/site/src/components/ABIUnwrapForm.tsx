import { ERC20_ID, JoinSplitRequest } from "@nocturne-xyz/sdk";
import React, { useState } from "react";
import { Button } from "./Buttons";
import { isAddress } from "ethers/lib/utils";

enum AssetType {
  ERC20 = "ERC20",
  ERC721 = "ERC721",
  ERC1155 = "ERC1155",
}

export interface ABIUnwrapFormProps {
  handleJoinSplitRequest: (joinSplitRequest: JoinSplitRequest) => void;
}

export const ABIUnwrapForm = ({
  handleJoinSplitRequest,
}: ABIUnwrapFormProps) => {
  const [assetType, setAssetType] = useState<AssetType>(AssetType.ERC20);
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

  const handleEnqueueUnwrapAsset = () => {
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

    let unwrapValue;
    try {
      unwrapValue = BigInt(amount);
    } catch {
      alert("Invalid amount");
      return;
    }

    const joinSplitRequest: JoinSplitRequest = {
      asset: {
        address: assetAddress,
        id: assetType === AssetType.ERC20 ? ERC20_ID : id,
      },
      unwrapValue,
    };

    handleJoinSplitRequest(joinSplitRequest);
  };

  return (
    <div>
      <h3>Unwrap Assets</h3>
      <div>
        <label>
          Asset Type:
          <select value={assetType} onChange={handleAssetTypeChange}>
            <option value="ERC20">ERC20</option>
            <option value="ERC721">ERC721</option>
            <option value="ERC1155">ERC1155</option>
          </select>
        </label>
        <br />
        <label>
          Asset Contract Address:
          <input
            type="text"
            value={assetAddress}
            onChange={(e) => setAssetAddress(e.target.value)}
            disabled={assetType === "ERC721"}
          />
        </label>
        <label>
          Amount:
          <input
            type="number"
            value={amount}
            onChange={handleAmountChange}
            disabled={assetType === "ERC721"}
          />
        </label>
        <br />
        <label>
          Asset ID:
          <input
            type="text"
            value={assetID.toString()}
            onChange={handleAssetIDChange}
            disabled={assetType === "ERC20"}
          />
        </label>
        <Button onClick={() => handleEnqueueUnwrapAsset()}>
          Enqueue Unwrap Asset
        </Button>
      </div>
    </div>
  );
};
