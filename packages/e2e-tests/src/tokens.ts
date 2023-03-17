import {
  SimpleERC1155Token__factory,
  SimpleERC20Token__factory,
  SimpleERC721Token__factory,
} from "@nocturne-xyz/contracts";
import { SimpleERC1155Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC1155Token";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { SimpleERC721Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC721Token";
import { Asset, AssetType } from "@nocturne-xyz/sdk";
import { ethers } from "ethers";

// returns [token, asset]
export async function deployERC20(
  eoa: ethers.Wallet
): Promise<[SimpleERC20Token, Asset]> {
  const token = await new SimpleERC20Token__factory(eoa).deploy();
  const asset: Asset = {
    assetType: AssetType.ERC20,
    assetAddr: token.address,
    id: 0n,
  };

  return [token, asset];
}

// returns [token, assetConstructor]
export async function deployERC721(
  eoa: ethers.Wallet
): Promise<[SimpleERC721Token, (id: bigint) => Asset]> {
  const token = await new SimpleERC721Token__factory(eoa).deploy();
  const assetConstructor = (id: bigint) => ({
    assetType: AssetType.ERC721,
    assetAddr: token.address,
    id,
  });

  return [token, assetConstructor];
}

// returns [token, assetConstructor]
export async function deployERC1155(
  eoa: ethers.Wallet
): Promise<[SimpleERC1155Token, (id: bigint) => Asset]> {
  const token = await new SimpleERC1155Token__factory(eoa).deploy();
  const assetConstructor = (id: bigint) => ({
    assetType: AssetType.ERC1155,
    assetAddr: token.address,
    id,
  });

  return [token, assetConstructor];
}
