import { FlaxAddress } from "./crypto/address";
import { poseidon } from "circomlibjs";
import { NoteInput } from "./proof/spend2";

type Address = string;

interface NoteConstructor {
  owner: FlaxAddress;
  nonce: bigint;
  asset: Address;
  id: bigint;
  value: bigint;
}

export class Note {
  owner: FlaxAddress;
  nonce: bigint;
  asset: Address;
  id: bigint;
  value: bigint;

  constructor({ owner, nonce, asset, id, value }: NoteConstructor) {
    this.owner = owner;
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
      owner: this.owner.toFlattened(),
      nonce: this.nonce,
      asset: BigInt(this.asset),
      id: this.id,
      value: this.value,
    };
  }
}
