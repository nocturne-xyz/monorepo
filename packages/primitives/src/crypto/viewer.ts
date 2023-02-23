import { CanonAddress, StealthAddress, StealthAddressTrait } from "./address";
import { ViewingKey } from "./keys";
import randomBytes from "randombytes";
import { BabyJubJub, poseidonBN } from "@nocturne-xyz/circuit-utils";
import { IncludedNote, Note, NoteTrait } from "../note";
import { EncryptedNote } from "../types";
import { Asset } from "../asset";
import { decryptNote } from "./noteEncryption";

const Fr = BabyJubJub.ScalarField;

export class NocturneViewer {
  vk: ViewingKey;

  constructor(vk: ViewingKey) {
    this.vk = vk;
  }

  canonicalAddress(): CanonAddress {
    const addr = BabyJubJub.scalarMul(BabyJubJub.BasePoint, this.vk);
    return addr;
  }

  canonicalStealthAddress(): StealthAddress {
    const canonAddr = this.canonicalAddress();
    return {
      h1X: BabyJubJub.BasePoint.x,
      h1Y: BabyJubJub.BasePoint.y,
      h2X: canonAddr.x,
      h2Y: canonAddr.y,
    };
  }

  generateRandomStealthAddress(): StealthAddress {
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Fr.fromBytes(r_buf);
    const h1 = BabyJubJub.scalarMul(BabyJubJub.BasePoint, r);
    const h2 = BabyJubJub.scalarMul(h1, this.vk);
    return StealthAddressTrait.fromPoints({ h1, h2 });
  }

  createNullifier(note: Note): bigint {
    if (!this.isOwnAddress(note.owner)) {
      throw Error("Attempted to create nullifier for note you do not own");
    }

    return poseidonBN([NoteTrait.toCommitment(note), this.vk]);
  }

  generateNewNonce(oldNullifier: bigint): bigint {
    return poseidonBN([this.vk, oldNullifier]);
  }

  isOwnAddress(addr: StealthAddress): boolean {
    const points = StealthAddressTrait.toPoints(addr);
    const h2Prime = BabyJubJub.scalarMul(points.h1, this.vk);

    return BabyJubJub.eq(points.h2, h2Prime);
  }

  /**
   * Obtain the note from a note transmission. Assumes that the signer owns the
   * note transmission.
   *
   * @param encryptedNote
   * @param asset, id, merkleIndex additional params from the joinsplit event
   * @return note
   */
  getNoteFromEncryptedNote(
    encryptedNote: EncryptedNote,
    merkleIndex: number,
    asset: Asset
  ): IncludedNote {
    if (!this.isOwnAddress(encryptedNote.owner)) {
      throw Error("Cannot decrypt a note that is not owned by signer.");
    }

    const note = decryptNote(
      this.canonicalStealthAddress(),
      this.vk,
      encryptedNote,
      asset
    );

    return {
      ...note,
      merkleIndex,
    };
  }
}
