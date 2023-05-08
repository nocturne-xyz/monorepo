import { ProtocolAllowlist } from "@nocturne-xyz/config";
import {
  Handler,
  SimpleERC1155Token__factory,
  SimpleERC20Token__factory,
  SimpleERC721Token__factory,
} from "@nocturne-xyz/contracts";
import { SimpleERC1155Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC1155Token";
import { SimpleERC20Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC20Token";
import { SimpleERC721Token } from "@nocturne-xyz/contracts/dist/src/SimpleERC721Token";
import { whitelistProtocols } from "@nocturne-xyz/deploy";
import { Asset, AssetType } from "@nocturne-xyz/sdk";
import { ethers } from "ethers";

// returns [token, asset]
export async function deployAndWhitelistERC20(
  eoa: ethers.Wallet,
  handler: Handler
): Promise<[SimpleERC20Token, Asset]> {
  if ((await handler.owner()) != eoa.address) {
    throw new Error("token deployer must be handler owner");
  }

  const erc20 = await new SimpleERC20Token__factory(eoa).deploy();

  const whitelistEntries: ProtocolAllowlist = new Map([
    [
      "erc20", // dummy name
      erc20.address,
    ],
  ]);

  await whitelistProtocols(eoa, whitelistEntries, handler);

  const asset: Asset = {
    assetType: AssetType.ERC20,
    assetAddr: erc20.address,
    id: 0n,
  };

  return [erc20, asset];
}

// returns [token, assetConstructor]
export async function deployAndWhitelistERC721(
  eoa: ethers.Wallet,
  handler: Handler
): Promise<[SimpleERC721Token, (id: bigint) => Asset]> {
  if ((await handler.owner()) != eoa.address) {
    throw new Error("token deployer must be handler owner");
  }

  const erc721 = await new SimpleERC721Token__factory(eoa).deploy();

  const whitelistEntries: ProtocolAllowlist = new Map([
    [
      "erc721", // dummy name
      erc721.address,
    ],
  ]);

  await whitelistProtocols(eoa, whitelistEntries, handler);

  const assetConstructor = (id: bigint) => ({
    assetType: AssetType.ERC721,
    assetAddr: erc721.address,
    id,
  });

  return [erc721, assetConstructor];
}

// returns [token, assetConstructor]
export async function deployAndWhitelistERC1155(
  eoa: ethers.Wallet,
  handler: Handler
): Promise<[SimpleERC1155Token, (id: bigint) => Asset]> {
  if ((await handler.owner()) != eoa.address) {
    throw new Error("token deployer must be handler owner");
  }

  const erc1155 = await new SimpleERC1155Token__factory(eoa).deploy();

  const whitelistEntries: ProtocolAllowlist = new Map([
    [
      "erc1155", // dummy name
      erc1155.address,
    ],
  ]);

  await whitelistProtocols(eoa, whitelistEntries, handler);

  const assetConstructor = (id: bigint) => ({
    assetType: AssetType.ERC1155,
    assetAddr: erc1155.address,
    id,
  });

  return [erc1155, assetConstructor];
}
