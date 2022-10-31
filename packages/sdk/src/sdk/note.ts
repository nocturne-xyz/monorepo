import {
  FlattenedFlaxAddress,
  FlattenedFlaxAddressStruct,
} from "../crypto/address";
import { Address, Asset } from "../commonTypes";
import { poseidon } from "circomlibjs";
import { NoteInput } from "../proof/spend2";

interface NoteStruct {
  owner: FlattenedFlaxAddressStruct;
  nonce: bigint;
  asset: Address;
  id: bigint;
  value: bigint;
}

export class Note {
  owner: FlattenedFlaxAddress;
  nonce: bigint;
  asset: Address;
  id: bigint;
  value: bigint;

  constructor({ owner, nonce, asset, id, value }: NoteStruct) {
    this.owner = new FlattenedFlaxAddress(owner);
    this.nonce = nonce;
    this.asset = asset;
    this.id = id;
    this.value = value;
  }

  toCommitment(): bigint {
    return BigInt(
      poseidon([
        this.owner.hash(),
        this.nonce,
        BigInt(this.asset),
        this.id,
        this.value,
      ])
    );
  }

  toNoteInput(): NoteInput {
    return {
      owner: this.owner,
      nonce: this.nonce,
      asset: BigInt(this.asset),
      id: this.id,
      value: this.value,
    };
  }

  getAsset(): Asset {
    return new Asset(this.asset, this.id);
  }
}

export interface IncludedNoteStruct extends NoteStruct {
  merkleIndex: number;
}

export class IncludedNote extends Note {
  merkleIndex: number;

  constructor(note: NoteStruct, merkleIndex: number) {
    super(note);
    this.merkleIndex = merkleIndex;
  }

  static fromStruct(note: IncludedNoteStruct): IncludedNote {
    return new IncludedNote(
      {
        owner: new FlattenedFlaxAddress(note.owner),
        nonce: note.nonce,
        asset: note.asset,
        id: note.id,
        value: note.value,
      },
      note.merkleIndex
    );
  }

  toStruct(): IncludedNoteStruct {
    return {
      owner: this.owner.toStruct(),
      nonce: this.nonce,
      asset: this.asset,
      id: this.id,
      value: this.value,
      merkleIndex: this.merkleIndex,
    };
  }
}
