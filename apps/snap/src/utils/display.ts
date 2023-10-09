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
  opMetadata: OperationMetadata
): Panel => {
  const [summaries, details] = unzip(
    opMetadata.items.map((item) => {
      if (item.type === "ConfidentialPayment") {
        return [
          text(
            formatConfPaymentMetadataSummary(
              item.metadata as ConfidentialPaymentMetadata
            )
          ),
          makeConfidentialPaymentMetadataDetails(
            item.metadata as ConfidentialPaymentMetadata
          ),
        ];
      } else {
        return [
          text((item.metadata as ActionMetadata).summary),
          makeActionMetadataDetails(item.metadata as ActionMetadata),
        ];
      }
    })
  );

  return panel([
    panel([heading("Summary"), ...summaries]),
    divider(),
    panel([heading("Details"), ...details]),
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

const makeConfidentialPaymentMetadataDetails = (
  meta: ConfidentialPaymentMetadata
): Panel => {
  const summary = formatConfPaymentMetadataSummary(meta);

  const { asset, amount, recipient } = meta;
  return panel([
    heading(summary),
    panel([
      heading("Details"),
      text(`assetType: ${asset.assetType}`),
      text(`assetContractAddress: ${asset.assetAddr}`),
      text(`assetId: ${asset.id}`),
      text(`amount: ${amount}`),
      text(`recipient: ${formatCanonAddr(recipient)}`),
    ]),
  ]);
};

const makeActionMetadataDetails = (meta: ActionMetadata): Panel => {
  const { summary, pluginInfo, details } = meta;

  const { name, source } = pluginInfo;
  const pluginInfoNode = text(
    `created by plugin ${name} (${source ?? "not open source"})`
  );

  const detailsNodes = details
    ? Object.keys(details).map((key) => text(`${key}: ${details[key]}`))
    : [];

  return panel([
    heading(summary),
    panel([heading("details"), ...detailsNodes, pluginInfoNode]),
  ]);
};
