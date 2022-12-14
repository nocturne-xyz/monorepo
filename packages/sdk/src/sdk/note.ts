import { NocturneAddressTrait, NocturneAddress } from "../crypto/address";
import { Address } from "../commonTypes";
import { poseidon } from "circomlibjs";
import { sha256 } from "js-sha256";
import { bigintToBEPadded } from "./utils";

export interface Note {
  owner: NocturneAddress;
  nonce: bigint;
  asset: Address;
  id: bigint;
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
    const { owner, nonce, asset, id, value }= NoteTrait.toEncoded(note);
    return BigInt(
      poseidon([
        NocturneAddressTrait.hash(owner),
        nonce,
        asset,
        id,
        value,
      ])
    );
  }

  static sha256(note: Note): number[] {
    const noteInput = NoteTrait.toEncoded(note);
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
    { owner, nonce, asset, id, value }: Note,
    merkleIndex: number
  ): IncludedNote {
    return { owner, nonce, asset, id, value, merkleIndex };
  }

  static toEncoded(note: Note): EncodedNote {
    const { owner, nonce, value } = note;
    const asset = encodeAsset(note.asset, note.id);
    const id = encodeID(note.id);

    return {
      owner,
      nonce,
      asset,
      id,
      value,
    };
  }
}

export function encodeAsset(asset: string, id: bigint): EncodedAsset {
  const eightyEightZeros = "".padStart(88, "0");
  const assetBits = BigInt(asset).toString(2).padStart(160, "0");
  if (assetBits.length > 160) {
    throw new Error("number repr of `asset` is too large");
  }

  const idBits = id.toString(2).padStart(256, "0");
  const idTop3 = idBits.slice(0, 3);


  return BigInt(`0b000${idTop3}${eightyEightZeros}00${assetBits}`);
}

export function decodeAsset(encodedAsset: EncodedAsset): string {
  const encodedAssetBits = encodedAsset.toString(2).padStart(256, "0");
  const assetBits = encodedAssetBits.slice(96);
  return BigInt(`0b${assetBits}`).toString(16);
}

export function encodeID(id: bigint): EncodedID {
  const idBits = id.toString(2).padStart(256, "0");
  return BigInt(`0b000${idBits.slice(3)}`);
}

export function decodeID(encodedID: EncodedID, encodedAsset: EncodedAsset): bigint {
  const encodedAssetBits = encodedAsset.toString(2).padStart(256, "0");
  const idTop3 = encodedAssetBits.slice(3, 6);
  const encodedIDBits = encodedID.toString(2).padStart(256, "0").slice(3);
  return BigInt(`0b${idTop3}${encodedIDBits}`);
}
