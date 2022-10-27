import { FlattenedFlaxAddress } from "../crypto/address";
import { Address } from "../commonTypes";
import { poseidon } from "circomlibjs";
import { NoteInput } from "../proof/spend2";
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";

interface NoteConstructor {
  owner: FlattenedFlaxAddress;
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
      owner: this.owner,
      nonce: this.nonce,
      asset: BigInt(this.asset),
      id: this.id,
      value: this.value,
    };
  }
}

export class PendingNote extends Note {
  merkleIndex: number;

  constructor(note: NoteConstructor, merkleIndex: number) {
    super(note);
    this.merkleIndex = merkleIndex;
  }

  toSpendable(merkleProof: MerkleProof): SpendableNote {
    const { owner, nonce, asset, id, value } = this;
    return new SpendableNote(
      {
        owner,
        nonce,
        asset,
        id,
        value,
      },
      merkleProof
    );
  }
}

export class SpendableNote extends Note {
  merkleProof: MerkleProof;

  constructor(note: NoteConstructor, merkleProof: MerkleProof) {
    super(note);
    this.merkleProof = merkleProof;
  }
}
