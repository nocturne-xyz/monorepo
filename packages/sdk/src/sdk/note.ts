import { NocturneAddressTrait, NocturneAddress } from "../crypto/address";
import { Asset, decodeAsset, encodeAsset } from "../commonTypes";
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
