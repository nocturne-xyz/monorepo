import { Address, AssetWithBalance } from "@nocturne-xyz/sdk";
import React, { useState, useEffect } from "react";
import {
  formatAbbreviatedAddress,
  formatTokenAmountUserRepr,
  getTokenDetails,
  TokenDetails,
} from "../common";
import { NocturneFrontendSDK } from "../sdk";

interface AssetBalancesDisplayProps {
  frontendSDK?: NocturneFrontendSDK;
}

interface AbbreviatedAssetWithBalance extends AssetWithBalance {
  abbreviatedAddress: string;
  tokenDetails: TokenDetails;
}

export const AssetBalancesDisplay: React.FC<AssetBalancesDisplayProps> = ({
  frontendSDK,
}) => {
  const [balances, setBalances] = useState<AbbreviatedAssetWithBalance[]>([]);
  const [tokenDetails, setTokenDetails] = useState<Map<Address, TokenDetails>>(
    new Map()
  );

  const fetchData = async () => {
    if (!frontendSDK) return;

    console.log("Syncing snap balances...");
    const provider = frontendSDK.walletContract.provider;
    const data = await frontendSDK.getAllBalances();
    const abbreviated = await Promise.all(
      data.map(async ({ asset, balance }) => {
        const address = asset.assetAddr.toLowerCase();

        let details: TokenDetails;
        if (!tokenDetails.has(address)) {
          details = await getTokenDetails(asset.assetType, address, provider);
          setTokenDetails(tokenDetails.set(address, details));
        } else {
          details = tokenDetails.get(address)!;
        }

        const { assetAddr } = asset;
        const abbreviatedAddress = formatAbbreviatedAddress(assetAddr);
        return { asset, balance, abbreviatedAddress, tokenDetails: details };
      })
    );
    setBalances(abbreviated);
  };

  const handleClick = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchData();
    }, 7_000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <table>
      <thead>
        <tr>
          <th style={{ textAlign: "left" }}>Symbol</th>
          <th style={{ textAlign: "left" }}>Address</th>
          <th style={{ textAlign: "left" }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {balances.map((balance, index) => (
          <tr key={index}>
            <td style={{ textAlign: "left" }}>{balance.tokenDetails.symbol}</td>
            <td
              style={{ textAlign: "left", color: "#ADD8E6", cursor: "pointer" }}
              onClick={() => handleClick(balance.asset.assetAddr.toLowerCase())}
            >
              {balance.abbreviatedAddress.toLowerCase()}
            </td>
            <td style={{ textAlign: "left" }}>
              {formatTokenAmountUserRepr(
                balance.balance,
                balance.tokenDetails.decimals
              ).toString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AssetBalancesDisplay;
