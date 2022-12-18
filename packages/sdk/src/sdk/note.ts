import { NocturneAddressTrait, NocturneAddress } from "../crypto/address";
import { Asset, AssetType, EncodedAsset } from "../commonTypes";
import { poseidon } from "circomlibjs";
import { sha256 } from "js-sha256";
import { bigintToBEPadded } from "./utils";

export interface Note {
  owner: NocturneAddress;
  nonce: bigint;
  asset: Asset;
  value: bigint;
}

export interface IncludedNote extends Note {
  merkleIndex: number;
}

export interface EncodedNote {
  owner: NocturneAddress;
  nonce: bigint;
  encodedAddr: EncodedAddr;
  encodedId: EncodedID;
  value: bigint;
}

export type EncodedAddr = bigint;
export type EncodedID = bigint;

export class NoteTrait {
  static toCommitment(note: Note): bigint {
    const {
      owner,
      nonce,
      encodedAddr: asset,
      encodedId: id,
      value,
    } = NoteTrait.encode(note);
    return BigInt(
      poseidon([NocturneAddressTrait.hash(owner), nonce, asset, id, value])
    );
  }

  static sha256(note: Note): number[] {
    const noteInput = NoteTrait.encode(note);
    const ownerH1 = bigintToBEPadded(noteInput.owner.h1X, 32);
    const ownerH2 = bigintToBEPadded(noteInput.owner.h2X, 32);
    const nonce = bigintToBEPadded(noteInput.nonce, 32);
    const asset = bigintToBEPadded(noteInput.encodedAddr, 32);
    const id = bigintToBEPadded(noteInput.encodedId, 32);
    const value = bigintToBEPadded(noteInput.value, 32);

    const preimage = [
      ...ownerH1,
      ...ownerH2,
      ...nonce,
      ...asset,
      ...id,
      ...value,
    ];
    return sha256.array(preimage);
  }

  static toIncludedNote(
    { owner, nonce, asset, value }: Note,
    merkleIndex: number
  ): IncludedNote {
    return { owner, nonce, asset, value, merkleIndex };
  }

  static encode(note: Note): EncodedNote {
    const { owner, nonce, value } = note;
    const { encodedAddr, encodedId } = encodeAsset(note.asset);

    return {
      owner,
      nonce,
      encodedAddr: encodedAddr,
      encodedId: encodedId,
      value,
    };
  }

  static decode(encodedNote: EncodedNote): Note {
    const { owner, nonce, value } = encodedNote;
    const asset = decodeAsset(encodedNote.encodedAddr, encodedNote.encodedId);

    return {
      owner,
      nonce,
      asset,
      value,
    };
  }
}

export function encodeAsset({ assetType, assetAddr, id }: Asset): EncodedAsset {
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
  const encodedId = BigInt(`0b000${idBits.slice(3)}`);
  const encodedAddr = BigInt(
    `0b000${idTop3}${eightyEightZeros}${assetTypeBits}${addrBits}`
  );
  return { encodedAddr, encodedId };
}

export function decodeAsset(encodedAddr: bigint, encodedId: bigint): Asset {
  const encodedAssetBits = encodedAddr.toString(2).padStart(256, "0");
  const assetBits = encodedAssetBits.slice(96);
  const assetAddr = "0x" + BigInt(`0b${assetBits}`).toString(16);

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
  const encodedIDBits = encodedId.toString(2).padStart(256, "0").slice(3);
  const id = BigInt(`0b${idTop3}${encodedIDBits}`);

  return {
    assetType,
    assetAddr,
    id,
  };
}
