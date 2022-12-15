import { NocturneAddressTrait, NocturneAddress } from "../crypto/address";
import { Asset, AssetType } from "../commonTypes";
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
  asset: EncodedAsset;
  id: EncodedID;
  value: bigint;
}

export type EncodedAsset = bigint;
export type EncodedID = bigint;

export class NoteTrait {
  static toCommitment(note: Note): bigint {
    const { owner, nonce, asset, id, value } = NoteTrait.encode(note);
    return BigInt(
      poseidon([NocturneAddressTrait.hash(owner), nonce, asset, id, value])
    );
  }

  static sha256(note: Note): number[] {
    const noteInput = NoteTrait.encode(note);
    const ownerH1 = bigintToBEPadded(noteInput.owner.h1X, 32);
    const ownerH2 = bigintToBEPadded(noteInput.owner.h2X, 32);
    const nonce = bigintToBEPadded(noteInput.nonce, 32);
    const asset = bigintToBEPadded(noteInput.asset, 32);
    const id = bigintToBEPadded(noteInput.id, 32);
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
    const [asset, id] = encodeAsset(note.asset);

    return {
      owner,
      nonce,
      asset,
      id,
      value,
    };
  }

  static decode(encodedNote: EncodedNote): Note {
    const { owner, nonce, value } = encodedNote;
    const asset = decodeAsset(encodedNote.asset, encodedNote.id);

    return {
      owner,
      nonce,
      asset,
      value,
    };
  }
}

export function encodeAsset({ address , id }: Asset): [EncodedAsset, EncodedID] {
  const eightyEightZeros = "".padStart(88, "0");
  const addrBits = BigInt(address).toString(2).padStart(160, "0");
  if (addrBits.length > 160) {
    throw new Error("number repr of `asset` is too large");
  }

  const idBits = id.toString(2).padStart(256, "0");
  const idTop3 = idBits.slice(0, 3);
  const encodedID = BigInt(`0b000${idBits.slice(3)}`);
  const encodedAsset = BigInt(`0b000${idTop3}${eightyEightZeros}00${addrBits}`);
  return [encodedAsset, encodedID];
}

export function decodeAsset(encodedAsset: EncodedAsset, encodedID: EncodedID): Asset {
  const encodedAssetBits = encodedAsset.toString(2).padStart(256, "0");
  const assetBits = encodedAssetBits.slice(96);
  const assetAddress = BigInt(`0b${assetBits}`).toString(16);

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
  const encodedIDBits = encodedID.toString(2).padStart(256, "0").slice(3);
  const id = BigInt(`0b${idTop3}${encodedIDBits}`);

  return {
    address: assetAddress,
    type: assetType,
    id,
  };
}
