import { Asset, AssetType, parseAssetType } from "@nocturne-xyz/sdk";
import { isAddress } from "ethers/lib/utils";
import React, { useState } from "react";

export interface ABIRefundAssetsFormProps {
  handleNewRefundAsset: (refundAsset: Asset) => void;
}

export const ABIRefundAssetsForm = ({
  handleNewRefundAsset,
}: ABIRefundAssetsFormProps) => {
  const [assetAddr, setAssetAddr] = useState("");
  const [assetType, setAssetType] = useState(AssetType.ERC20);
  const [assetId, setAssetId] = useState(0n);

  const handleAddOutputToken = () => {
    if (isAddress(assetAddr)) {
      const asset: Asset = {
        assetType,
        assetAddr,
        id: assetId,
      };
      handleNewRefundAsset(asset);
    } else {
      alert("Invalid output token address");
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: "20px" }}>Refund Assets</h1>

      <label>
        Refund Contract Token Address
        <br />
        <textarea
          style={{ resize: "none", width: "70%", height: "30px" }}
          value={assetAddr}
          onChange={(event) => setAssetAddr(event.target.value)}
        />
      </label>
      <br />
      <label>
        Asset Type
        <br />
        <select
          value={assetType}
          onChange={(e) => setAssetType(parseAssetType(e.target.value))}
        >
          <option value={AssetType.ERC20.toString()}>ERC20</option>
          <option value={AssetType.ERC721.toString()}>ERC721</option>
          <option value={AssetType.ERC1155.toString()}>ERC1155</option>
        </select>
      </label>
      <br />
      <label>
        Asset ID
        <br />
        <input
          type="text"
          value={assetId.toString()}
          onChange={(assetId) => setAssetId(BigInt(assetId.target.value))}
          disabled={assetType === AssetType.ERC20}
        />
      </label>

      <br />
      <br />
      <button onClick={handleAddOutputToken}>Add Output Token</button>
    </div>
  );
};
