import { CanonAddress, StealthAddress, StealthAddressTrait } from "./address";
import { ViewingKey } from "./keys";
import { BabyJubJub, poseidonBN } from "@nocturne-xyz/crypto-utils";
import { IncludedNote, Note, NoteSource, NoteTrait } from "../primitives/note";
import { EncryptedNote } from "../primitives/types";
import { decryptNote } from "./noteEncryption";
import { randomFr } from "./utils";

export class NocturneViewer {
  vk: ViewingKey;
  vkNonce: bigint;

  constructor(vk: ViewingKey, vkNonce: bigint) {
    this.vk = vk;
    this.vkNonce = vkNonce;
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
    const r = randomFr();
    const h1 = BabyJubJub.scalarMul(BabyJubJub.BasePoint, r);
    const h2 = BabyJubJub.scalarMul(h1, this.vk);
    return StealthAddressTrait.fromPoints({ h1, h2 });
  }

  createNullifier<N extends Note>(note: N): bigint {
    if (!this.isOwnAddress(note.owner)) {
      throw Error(
        "attempted to create nullifier for a note that is not owned by signer"
      );
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
  decryptNote(
    encryptedNote: EncryptedNote,
    merkleIndex: number
  ): [IncludedNote, CanonAddress] {
    const { sender, ...note } = decryptNote(this.vk, encryptedNote);

    return [
      {
        ...note,
        noteSource: NoteSource.JoinSplit,
        merkleIndex,
      },
      sender,
    ];
  }
}
