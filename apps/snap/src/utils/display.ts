import { Erc20Config } from "@nocturne-xyz/config";
import { Address, CanonAddrRegistryEntry } from "@nocturne-xyz/core";
import { OperationMetadata } from "@nocturne-xyz/client";
import { formatUnits } from "ethers/lib/utils";

const lookupTickerByAddress = (
  address: string,
  erc20s: Map<string, Erc20Config>
): string | undefined => {
  const addressToTicker = Array.from(erc20s.entries()).reduce(
    (acc: Map<string, string>, [ticker, asset]) =>
      acc.set(asset.address.toLowerCase(), ticker.toUpperCase()),
    new Map<string, string>()
  );

  return addressToTicker.get(address.toLowerCase());
};

export const makeSignCanonAddrRegistryEntryContent = (
  entry: CanonAddrRegistryEntry,
  chainId: bigint,
  registryAddress: Address
): {
  heading: string;
  text: string;
} => {
  const heading = "Confirm signature to register canonical address";
  const text = `Ethereum Address: ${entry.ethAddress}. Nocturne Canonical Address Nonce: ${entry.perCanonAddrNonce}. Chain id: ${chainId}. Registry address: ${registryAddress}`;

  return {
    heading,
    text,
  };
};

export const makeSignOperationContent = (
  opMetadata: OperationMetadata,
  erc20s: Map<string, Erc20Config>
): {
  heading: string;
  messages: string[];
}[] => {
  return opMetadata.items.map((item) => {
    if (item.type !== "Action")
      throw new Error(`${item.type} snap display not yet supported`);

    let heading: string;
    const messages: string[] = [];
    switch (item.actionType) {
      case "Transfer": {
        const {
          amount: amountSmallestUnits,
          recipientAddress,
          erc20Address,
        } = item;
        const ticker = lookupTickerByAddress(erc20Address, erc20s);
        const displayAmount = formatUnits(amountSmallestUnits);

        heading = "Confirm transfer from your Nocturne account";
        messages.push(
          "Action: Transfer",
          `Amount: **${displayAmount}**`,
          `Asset Token: **${
            ticker ? ticker : `${erc20Address} _(Unrecognized asset)_`
          }**`,
          `Recipient Address: ${recipientAddress}`
        );
        break;
      }
      case "Transfer ETH": {
        const { recipientAddress, amount: amountSmallestUnits } = item;
        const displayAmountEth = formatUnits(amountSmallestUnits);
        heading = "Confirm transfer from your Nocturne account";
        messages.push(
          `Action: Send **${displayAmountEth} ETH**`,
          `Recipient Address: ${recipientAddress}`
        );
        break;
      }
      case "UniswapV3 Swap": {
        const { tokenIn, inAmount: amountSmallestUnits, tokenOut } = item;
        const tickerIn = lookupTickerByAddress(tokenIn, erc20s);
        const tickerOut = lookupTickerByAddress(tokenOut, erc20s);
        const displayAmountIn = formatUnits(amountSmallestUnits);
        heading = "Confirm token swap";

        if (tickerIn && tickerOut) {
          messages.push(
            `Action: Swap **${displayAmountIn} ${tickerIn}** for **${tickerOut}**`
          );
        } else {
          messages.push(
            "Action: Swap",
            `Amount: **${displayAmountIn}**`,
            `From token: **${tokenIn} _(Unrecognized asset)_**`,
            `To token: **${tokenOut} _(Unrecognized asset)_**`
          );
        }
        break;
      }
      default:
        throw new Error(`Operation type ${item.actionType} not yet supported!`);
    }

    return {
      heading,
      messages,
    };
  });
};
