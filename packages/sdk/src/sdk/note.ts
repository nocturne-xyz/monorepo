import {
  NocturneAddressStruct,
  flattenedNocturneAddressFromJSON,
  NocturneAddress,
} from "../crypto/address";
import { Address } from "../commonTypes";
import { poseidon } from "circomlibjs";
import { sha256 } from "js-sha256";
import { bigintToBEPadded } from "./utils";
import JSON from "json-bigint";
import { NoteInput } from "../proof";

interface NoteStruct {
  owner: NocturneAddressStruct;
  nonce: bigint;
  asset: Address;
  id: bigint;
  value: bigint;
}

export class Note {
  inner: NoteStruct;

  constructor(note: NoteStruct) {
    this.inner = note;
  }

  static newDummy(
    owner: NocturneAddressStruct,
    asset: Address,
    id: bigint): Note
    {
      return new Note({
        owner,
        nonce: 0n,
        asset,
        id,
        value: 0n,
      });
  }

  get owner(): NocturneAddressStruct {
    return this.inner.owner;
  }

  get nonce(): bigint {
    return this.inner.nonce;
  }

  get asset(): Address {
    return this.inner.asset;
  }

  get id(): bigint {
    return this.inner.id;
  }

  get value(): bigint {
    return this.inner.value;
  }

  toCommitment(): bigint {
    const { owner, nonce, asset, id, value } = this.inner;
    const ownerNocturneAddr = new NocturneAddress(owner);
    return BigInt(
      poseidon([ownerNocturneAddr.hash(), nonce, BigInt(asset), id, value])
    );
  }

  toNoteInput(): NoteInput {
    const { owner, nonce, asset, id, value } = this.inner;
    return {
      owner: owner,
      nonce: nonce,
      asset: BigInt(asset),
      id: id,
      value: value,
    };
  }

  sha256(): number[] {
    const note = this.toNoteInput();
    const ownerH1 = bigintToBEPadded(note.owner.h1X, 32);
    const ownerH2 = bigintToBEPadded(note.owner.h2X, 32);
    const nonce = bigintToBEPadded(note.nonce, 32);
    const asset = bigintToBEPadded(note.asset, 32);
    const id = bigintToBEPadded(note.id, 32);
    const value = bigintToBEPadded(note.value, 32);

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

  toIncluded(merkleIndex: number): IncludedNote {
    const { owner, nonce, asset, id, value } = this.inner;
    return new IncludedNote({ owner, nonce, asset, id, value, merkleIndex });
  }
}

export interface IncludedNoteStruct extends NoteStruct {
  merkleIndex: number;
}

export function includedNoteStructFromJSON(
  jsonOrString: string | any
): IncludedNoteStruct {
  const json: any =
    typeof jsonOrString == "string" ? JSON.parse(jsonOrString) : jsonOrString;
  const { owner, nonce, asset, id, value, merkleIndex } = json;
  return {
    owner: flattenedNocturneAddressFromJSON(owner),
    nonce: BigInt(nonce),
    asset: asset.toString(),
    id: BigInt(id),
    value: BigInt(value),
    merkleIndex,
  };
}

export class IncludedNote extends Note {
  merkleIndex: number;

  constructor(includedNote: IncludedNoteStruct) {
    const { owner, nonce, asset, id, value } = includedNote;
    super({ owner, nonce, asset, id, value });
    this.merkleIndex = includedNote.merkleIndex;
  }

  static newDummy(
    owner: NocturneAddressStruct,
    asset: Address,
    id: bigint): IncludedNote
    {
      return new IncludedNote({
        owner,
        nonce: 0n,
        asset,
        id,
        value: 0n,
        merkleIndex: 0
      });
  }

  toStruct(): IncludedNoteStruct {
    const { owner, nonce, asset, id, value } = this.inner;
    return {
      owner,
      nonce,
      asset,
      id,
      value,
      merkleIndex: this.merkleIndex,
    };
  }
}
