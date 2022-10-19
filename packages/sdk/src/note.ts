import { FlaxAddress } from "./crypto/address";
import { poseidon } from "circomlibjs";
import { NoteInput } from "./proof/spend2";

type Address = string;

interface NoteConstructor {
  owner: FlaxAddress;
  nonce: bigint;
  type: Address;
  id: bigint;
  value: bigint;
}

export class Note {
  owner: FlaxAddress;
  nonce: bigint;
  type: Address;
  id: bigint;
  value: bigint;

  constructor({ owner, nonce, type, id, value }: NoteConstructor) {
    this.owner = owner;
    this.nonce = nonce;
    this.type = type;
    this.id = id;
    this.value = value;
  }

  toCommitment(): bigint {
    return BigInt(
      poseidon([
        this.owner.hash(),
        this.nonce,
        BigInt(this.type),
        this.id,
        this.value,
      ])
    );
  }

  toNoteInput(): NoteInput {
    return {
      owner: this.owner.toFlattened(),
      nonce: this.nonce,
      type: BigInt(this.type),
      id: this.id,
      value: this.value,
    };
  }
}
