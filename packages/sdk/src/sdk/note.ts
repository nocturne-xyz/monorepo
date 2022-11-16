import {
  FlaxAddressStruct,
  flattenedFlaxAddressFromJSON,
  FlaxAddress,
} from "../crypto/address";
import { Address } from "../commonTypes";
import { poseidon } from "circomlibjs";
import { NoteInput } from "../proof/spend2";
import { bigInt256ToBEBytes } from "./utils";
import { sha256 } from "js-sha256";

interface NoteStruct {
  owner: FlaxAddressStruct;
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

  get owner(): FlaxAddressStruct {
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
    const ownerFlaxAddr = new FlaxAddress(owner);
    return BigInt(
      poseidon([ownerFlaxAddr.hash(), nonce, BigInt(asset), id, value])
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
    const ownerH1 = bigInt256ToBEBytes(note.owner.h1X);
    const ownerH2 = bigInt256ToBEBytes(note.owner.h2X);
    const nonce = bigInt256ToBEBytes(note.nonce);
    const asset = bigInt256ToBEBytes(note.asset);
    const id = bigInt256ToBEBytes(note.id);
    const value = bigInt256ToBEBytes(note.value);
    
    const preimage = [...ownerH1, ...ownerH2, ...nonce, ...asset, ...id, ...value];
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
    owner: flattenedFlaxAddressFromJSON(owner),
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
