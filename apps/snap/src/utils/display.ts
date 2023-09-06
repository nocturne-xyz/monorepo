import { Erc20Config } from "@nocturne-xyz/config";
import {
  Address,
  CanonAddrRegistryEntry,
  OperationMetadata,
} from "@nocturne-xyz/core";
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
  text: string;
}[] => {
  return opMetadata.items.map((item) => {
    if (item.type === "ConfidentialPayment")
      throw new Error(`${item.type} snap display not yet supported`);
    const {
      amount: amountSmallestUnits,
      recipientAddress,
      erc20Address,
      actionType: operationType,
    } = item;

    if (operationType !== "Transfer") {
      throw new Error(`Operation type ${operationType} not yet supported!`);
    }

    const ticker = lookupTickerByAddress(erc20Address, erc20s);
    const displayAmount = formatUnits(amountSmallestUnits);
    const recognizedTicker = `Action: Send **${displayAmount} ${ticker}**
  Recipient Address: ${recipientAddress}`;
    const unrecognizedTicker = `Amount: ${displayAmount}
Asset token address: ${erc20Address} _(Unrecognized asset)_
Recipient Address: ${recipientAddress}
`;

    const heading = "Confirm transfer from your Nocturne account";
    const text = ticker ? recognizedTicker : unrecognizedTicker;

    return {
      heading,
      text,
    };
  });
};
