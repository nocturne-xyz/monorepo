import { AssetWithBalance } from "@nocturne-xyz/sdk";
import React, { useState, useEffect } from "react";
import { NocturneFrontendSDK } from "../sdk";

interface AssetBalancesDisplayProps {
  frontendSDK?: NocturneFrontendSDK;
}

export const AssetBalancesDisplay: React.FC<AssetBalancesDisplayProps> = ({
  frontendSDK,
}) => {
  const [balances, setBalances] = useState<AssetWithBalance[]>([]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!frontendSDK) return;

      console.log("Syncing snap balances...");
      frontendSDK
        .getAllBalances()
        .then((response) => {
          console.log("Balances: ", response);
          setBalances(response);
        })
        .catch((error) => console.log(error));
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div>
      <div>
        {balances.map(({ asset, balance }, index) => {
          return (
            <div
              key={index}
              style={{
                backgroundColor: "#505050",
                color: "white",
                overflowWrap: "break-word",
                padding: "5px",
              }}
            >
              <div>{`Address: ${asset.assetAddr}`}</div>
              <div>{`Balance: ${balance}`}</div>
              {index !== balances.length - 1 && (
                <div
                  style={{
                    height: "1px",
                    width: "100%",
                    backgroundColor: "white",
                    margin: "5px 0 0 0",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AssetBalancesDisplay;
