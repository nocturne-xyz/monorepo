import { Address } from "@nocturne-xyz/core";
import * as ethers from "ethers";
import SanctionsListAbi from "./abis/SanctionsList.json";

const SANCTIONS_LIST_CONTRACT_ADDRS: Record<number, Address> = {
  1: "0x40c57923924b5c5c5455c48d93317139addac8fb",
};

export async function isSanctionedAddress(
  provider: ethers.providers.Provider,
  address: Address
): Promise<boolean> {
  const chainId = (await provider.getNetwork()).chainId;
  // skip check if there's no sanctions contract on this chain
  if (!SANCTIONS_LIST_CONTRACT_ADDRS[chainId]) {
    return false;
  }

  const contract = new ethers.Contract(
    SANCTIONS_LIST_CONTRACT_ADDRS[chainId],
    SanctionsListAbi,
    provider
  );
  return (await contract.isSanctioned(address)) as unknown as boolean;
}
