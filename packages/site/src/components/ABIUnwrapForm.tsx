import { AssetType, parseAssetType } from "@nocturne-xyz/sdk";
import React, { useState } from "react";
import { Button } from "./Buttons";
import { isAddress } from "ethers/lib/utils";
import {
  getTokenDetails,
  getWindowSigner,
  formatTokenAmountEvmRepr,
} from "@nocturne-xyz/frontend-sdk";
import { JoinSplitRequestWithDecimals } from "../types/display";

export interface ABIUnwrapFormProps {
  handleJoinSplitRequest: (
    joinSplitRequest: JoinSplitRequestWithDecimals
  ) => void;
}

export const ABIUnwrapForm = ({
  handleJoinSplitRequest,
}: ABIUnwrapFormProps) => {
  const [assetType, setAssetType] = useState<AssetType>(AssetType.ERC20);
  const [assetAddress, setAssetAddress] = useState("");
  const [amount, setAmount] = useState("0");
  const [assetID, setAssetID] = useState("0");

  const handleAssetTypeChange = (event: any) => {
    setAssetType(parseAssetType(event.target.value));
  };

  const handleAssetIDChange = (event: any) => {
    const assetID = event.target.value;
    setAssetID(assetID);
  };

  const handleAmountChange = (event: any) => {
    const amount = event.target.value;
    setAmount(amount);
  };

  const handleEnqueueUnwrapAsset = async () => {
    if (!isAddress(assetAddress)) {
      alert("invalid asset address");
      return;
    }

    let id;
    try {
      id = BigInt(assetID);
    } catch {
      alert("invalid asset ID");
      return;
    }

    let unwrapValueDecimals;
    try {
      unwrapValueDecimals = Number(amount);
    } catch {
      alert("invalid amount");
      return;
    }

    const { decimals } = await getTokenDetails(
      assetType,
      assetAddress,
      await getWindowSigner()
    );
    const unwrapValue = formatTokenAmountEvmRepr(unwrapValueDecimals, decimals);

    const joinSplitRequest: JoinSplitRequestWithDecimals = {
      joinSplitRequest: {
        asset: {
          assetAddr: assetAddress,
          id: assetType === AssetType.ERC20 ? 0n : id,
          assetType: assetType,
        },
        unwrapValue,
      },
      decimals,
    };

    handleJoinSplitRequest(joinSplitRequest);
  };

  return (
    <div>
      <br />
      <h1 style={{ fontSize: "20px" }}>Unwrap Assets</h1>
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
        <Button onClick={async () => await handleEnqueueUnwrapAsset()}>
          Add Asset to Unwrap
        </Button>
      </div>
    </div>
  );
};
