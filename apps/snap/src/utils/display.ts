import {
  Address,
  CanonAddrRegistryEntry,
  CanonAddress,
  unzip,
} from "@nocturne-xyz/core";
import {
  ActionMetadata,
  ConfidentialPaymentMetadata,
  OperationMetadata,
} from "@nocturne-xyz/client";
import { Panel, divider, heading, panel, text } from "@metamask/snaps-ui";

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
  origin: string,
  opMetadata: OperationMetadata
): Panel => {
  const summaries = opMetadata.items.map((item) => {
    if (item.type === "ConfidentialPayment") {
      return text(
        formatConfPaymentMetadataSummary(
          item.metadata as ConfidentialPaymentMetadata
        )
      );
    } else {
      return text((item.metadata as ActionMetadata).summary);
    }
  });

  return panel([
    panel([
      heading(`${origin} would like to perform the following operation:"`),
      divider(),
      ...summaries,
      divider(),
    ]),
  ]);
};

// TODO: standard formatting for canon addrss in core
const formatCanonAddr = ({ x, y }: CanonAddress): string =>
  JSON.stringify({ x: x.toString(), y: y.toString() }, undefined, 2);
const formatConfPaymentMetadataSummary = ({
  displayAsset,
  displayAmount,
  recipient,
}: ConfidentialPaymentMetadata): string => {
  return `Send ${displayAmount} ${displayAsset} to ${formatCanonAddr(
    recipient
  )}`;
};
