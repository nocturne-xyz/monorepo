import { ethers, utils } from "ethers";
import { Address } from "./types";
import { bigintToBEPadded } from "../utils";
import { bigintFromBEBytes } from "../utils/bits";

export const ERC20_ID = 0n;

export enum AssetType {
  ERC20,
  ERC721,
  ERC1155,
}

export interface Asset {
  assetType: AssetType;
  assetAddr: Address;
  id: bigint;
}

export interface EncodedAsset {
  encodedAssetAddr: bigint;
  encodedAssetId: bigint;
}

export interface AssetWithBalance {
  asset: Asset;
  balance: bigint;
  numNotes: number;
}

// compact asset byte-serialization format (53 bytes)
// all bigints are represented in big-endian encoding
// 1. assetType: 1 byte
// 2. assetAddr: 20 bytes
// 3. id: 32 bytes
const COMPACT_SERIALIZE_OFFSETS = {
  assetType: 0,
  assetAddr: 1,
  id: 21,
  end: 53,
};

export class AssetTrait {
  static hash(asset: Asset): string {
    return utils.keccak256(
      utils.toUtf8Bytes(`${asset.assetAddr}:${asset.id.toString()}`)
    );
  }

  static serializeCompact(asset: Asset): Uint8Array {
    const buf = new Uint8Array(53);
    const { assetType, assetAddr, id } = asset;

    let assetTypeByte: number;
    switch (assetType) {
      case AssetType.ERC20:
        assetTypeByte = 0;
        break;
      case AssetType.ERC721:
        assetTypeByte = 1;
        break;
      case AssetType.ERC1155:
        assetTypeByte = 2;
        break;
    }

    buf.set([assetTypeByte], COMPACT_SERIALIZE_OFFSETS.assetType);
    buf.set(
      bigintToBEPadded(BigInt(assetAddr), 20),
      COMPACT_SERIALIZE_OFFSETS.assetAddr
    );
    buf.set(bigintToBEPadded(id, 32), COMPACT_SERIALIZE_OFFSETS.id);

    return buf;
  }

  static deserializeCompact(buf: Uint8Array): Asset {
    const assetType = AssetTrait.parseAssetType(
      buf[COMPACT_SERIALIZE_OFFSETS.assetType].toString()
    );

    const assetAddrBytes = buf.slice(
      COMPACT_SERIALIZE_OFFSETS.assetAddr,
      COMPACT_SERIALIZE_OFFSETS.id
    );
    const assetAddr = ethers.utils.getAddress(
      "0x" + bigintFromBEBytes(assetAddrBytes).toString(16)
    );

    const idBytes = buf.slice(
      COMPACT_SERIALIZE_OFFSETS.id,
      COMPACT_SERIALIZE_OFFSETS.end
    );
    const id = bigintFromBEBytes(idBytes);

    return {
      assetType,
      assetAddr,
      id,
    };
  }

  static parseAssetType(type: string): AssetType {
    switch (parseInt(type)) {
      case 0:
        return AssetType.ERC20;
      case 1:
        return AssetType.ERC721;
      case 2:
        return AssetType.ERC1155;
      default:
        throw new Error(`invalid asset type: ${type}`);
    }
  }

  static encode(asset: Asset): EncodedAsset {
    const { assetType, assetAddr, id } = asset;
    const eightyEightZeros = "".padStart(88, "0");
    const addrBits = BigInt(assetAddr).toString(2).padStart(160, "0");
    if (addrBits.length > 160) {
      throw new Error("number repr of `asset` is too large");
    }

    let assetTypeBits: string;
    switch (assetType) {
      case AssetType.ERC20: {
        assetTypeBits = "00";
        break;
      }
      case AssetType.ERC721: {
        assetTypeBits = "01";
        break;
      }
      case AssetType.ERC1155: {
        assetTypeBits = "10";
        break;
      }
    }

    const idBits = id.toString(2).padStart(256, "0");
    const idTop3 = idBits.slice(0, 3);
    const encodedAssetId = BigInt(`0b000${idBits.slice(3)}`);
    const encodedAssetAddr = BigInt(
      `0b000${idTop3}${eightyEightZeros}${assetTypeBits}${addrBits}`
    );
    return { encodedAssetAddr, encodedAssetId };
  }

  static isSame(a: Asset, b: Asset): boolean {
    return (
      a.assetAddr === b.assetAddr &&
      a.id === b.id &&
      a.assetType === b.assetType
    );
  }

  static decode(encodedAsset: EncodedAsset): Asset {
    const { encodedAssetAddr, encodedAssetId } = encodedAsset;
    const encodedAssetBits = encodedAssetAddr.toString(2).padStart(256, "0");
    const assetBits = encodedAssetBits.slice(96);
    const assetAddrLowercase =
      "0x" + BigInt(`0b${assetBits}`).toString(16).padStart(40, "0");
    const assetAddr = ethers.utils.getAddress(assetAddrLowercase);

    const assetTypeBits = encodedAssetBits.slice(94, 96);
    let assetType: AssetType;
    switch (assetTypeBits) {
      case "00":
        assetType = AssetType.ERC20;
        break;
      case "01":
        assetType = AssetType.ERC721;
        break;
      case "10":
        assetType = AssetType.ERC1155;
        break;
      default:
        throw new Error("invalid asset type bits");
    }

    const idTop3 = encodedAssetBits.slice(3, 6);
    const encodedIDBits = encodedAssetId
      .toString(2)
      .padStart(256, "0")
      .slice(3);
    const id = BigInt(`0b${idTop3}${encodedIDBits}`);

    return {
      assetType,
      assetAddr,
      id,
    };
  }

  static erc20AddressToAsset(address: string): Asset {
    return {
      assetType: AssetType.ERC20,
      assetAddr: address,
      id: ERC20_ID,
    };
  }

  static encodedAssetToString(encodedAsset: EncodedAsset): string {
    const { encodedAssetAddr, encodedAssetId } = encodedAsset;
    return `${encodedAssetAddr.toString()}:${encodedAssetId.toString()}`;
  }
}
