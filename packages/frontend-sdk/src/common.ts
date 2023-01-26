import { Address, AssetType } from "@nocturne-xyz/sdk";
import { ethers } from "ethers";
import ERC20 from "./abis/ERC20.json";
import ERC721 from "./abis/ERC721.json";
import ERC1155 from "./abis/ERC1155.json";

export const DEFAULT_SNAP_ORIGIN =
  process.env.REACT_APP_SNAP_ORIGIN ?? `local:http://localhost:8080`;

export async function getWindowSigner(): Promise<ethers.Signer> {
  const provider = new ethers.providers.Web3Provider(window.ethereum as any);
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

export function getTokenContract(
  assetType: AssetType,
  assetAddress: Address,
  signerOrProvider: ethers.Signer | ethers.providers.Provider
): ethers.Contract {
  let abi;
  if (assetType == AssetType.ERC20) {
    abi = ERC20;
  } else if (assetType == AssetType.ERC721) {
    abi = ERC721;
  } else if (assetType == AssetType.ERC1155) {
    abi = ERC1155;
  } else {
    throw new Error(`Unknown asset type: ${assetType}`);
  }

  return new ethers.Contract(assetAddress, abi, signerOrProvider);
}
