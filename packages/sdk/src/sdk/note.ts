import { NocturneAddressTrait, NocturneAddress } from "../crypto/address";
import { Address } from "../commonTypes";
import { poseidon } from "circomlibjs";
import { sha256 } from "js-sha256";
import { bigintToBEPadded } from "./utils";
import { NoteInput } from "../proof";

export interface Note {
  owner: NocturneAddress;
  nonce: bigint;
  asset: Address;
  id: bigint;
  value: bigint;
}

export class NoteTrait {
  static toCommitment({ owner, nonce, asset, id, value }: Note): bigint {
    return BigInt(
      poseidon([
        NocturneAddressTrait.hash(owner),
        nonce,
        BigInt(asset),
        id,
        value,
      ])
    );
  }

  static toNoteInput({ owner, nonce, asset, id, value }: Note): NoteInput {
    return {
      owner: owner,
      nonce: nonce,
      asset: BigInt(asset),
      id: id,
      value: value,
    };
  }

  static sha256(note: Note): number[] {
    const noteInput = NoteTrait.toNoteInput(note);
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
}

export interface IncludedNote extends Note {
  merkleIndex: number;
}
