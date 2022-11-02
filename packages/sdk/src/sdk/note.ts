import {
  FlaxAddressStruct,
  flattenedFlaxAddressFromJSON,
  FlaxAddress,
} from "../crypto/address";
import { Address } from "../commonTypes";
import { poseidon } from "circomlibjs";
import { NoteInput } from "../proof/spend2";

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

  toIncluded(merkleIndex: number): IncludedNote {
    const { owner, nonce, asset, id, value } = this.inner;
    return new IncludedNote({ owner, nonce, asset, id, value, merkleIndex });
  }
}

export interface IncludedNoteStruct extends NoteStruct {
  merkleIndex: number;
}

export function includedNoteStructFromJSON(
  jsonString: string
): IncludedNoteStruct {
  const json: any = JSON.parse(jsonString);
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
