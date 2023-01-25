import { AssetWithBalance } from "@nocturne-xyz/sdk";
import React, { useState, useEffect } from "react";
import { NocturneFrontendSDK } from "../sdk";

interface AssetBalancesDisplayProps {
  frontendSDK?: NocturneFrontendSDK;
}

interface AbbreviatedAssetWithBalance extends AssetWithBalance {
  abbreviatedAddress: string;
}

export const AssetBalancesDisplay: React.FC<AssetBalancesDisplayProps> = ({
  frontendSDK,
}) => {
  const [balances, setBalances] = useState<AbbreviatedAssetWithBalance[]>([]);

  const fetchData = async () => {
    if (!frontendSDK) return;

    console.log("Syncing snap balances...");
    const data = await frontendSDK.getAllBalances();
    const abbreviated = data.map(({ asset, balance }) => {
      const { assetAddr } = asset;
      const abbreviatedAddress =
        assetAddr.substring(0, 6) +
        "..." +
        assetAddr.substring(assetAddr.length - 4);
      return { asset, balance, abbreviatedAddress: abbreviatedAddress };
    });
    setBalances(abbreviated);
  };

  const handleClick = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchData();
    }, 5000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <table>
      <thead>
        <tr>
          <th style={{ textAlign: "left" }}>Address</th>
          <th style={{ textAlign: "left" }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {balances.map((balance, index) => (
          <tr key={index}>
            <td
              style={{ textAlign: "left", color: "#ADD8E6", cursor: "pointer" }}
              onClick={() => handleClick(balance.asset.assetAddr.toLowerCase())}
            >
              {balance.abbreviatedAddress.toLowerCase()}
            </td>
            <td style={{ textAlign: "left" }}>{balance.balance.toString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AssetBalancesDisplay;
