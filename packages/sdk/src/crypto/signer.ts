import {
  AffinePoint,
  BabyJubJub,
  poseidonBN,
} from "@nocturne-xyz/circuit-utils";
import randomBytes from "randombytes";
import { Note, IncludedNote, NoteTrait } from "../note";
import { Asset } from "../asset";
import { StealthAddress, StealthAddressTrait, CanonAddress } from "./address";
import { EncryptedNote } from "../commonTypes";
import { decryptNote } from "./noteEncryption";
import {
  SpendingKey,
  ViewingKey,
  spendPkFromFromSk,
  vkFromSpendPk,
} from "./keys";

const Fr = BabyJubJub.ScalarField;

export type SpendPk = AffinePoint<bigint>;

export interface NocturneSignature {
  c: bigint;
  z: bigint;
}

export class NocturneSigner {
  vk: ViewingKey;
  sk: SpendingKey;
  spendPk: SpendPk;

  constructor(sk: SpendingKey) {
    this.sk = sk;
    this.spendPk = spendPkFromFromSk(sk);
    this.vk = vkFromSpendPk(this.spendPk);
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

  sign(m: bigint): NocturneSignature {
    // TODO: make this deterministic
    const r_buf = randomBytes(Math.floor(256 / 8));
    const r = Fr.fromBytes(r_buf);
    const R = BabyJubJub.scalarMul(BabyJubJub.BasePoint, r);
    const c = poseidonBN([R.x, R.y, m]);

    // eslint-disable-next-line
    let z = Fr.reduce(r - (this.sk as any) * c);
    if (z < 0) {
      z += BabyJubJub.PrimeSubgroupOrder;
    }

    return {
      c,
      z,
    };
  }

  static verify(pk: SpendPk, m: bigint, sig: NocturneSignature): boolean {
    const c = sig.c;
    const z = sig.z;
    const Z = BabyJubJub.scalarMul(BabyJubJub.BasePoint, z);
    const P = BabyJubJub.scalarMul(pk, c);
    const R = BabyJubJub.add(Z, P);
    const cp = poseidonBN([R.x, R.y, m]);
    return c == cp;
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

  isOwnAddress(addr: StealthAddress): boolean {
    const points = StealthAddressTrait.toPoints(addr);
    const h2Prime = BabyJubJub.scalarMul(points.h1, this.vk);

    return BabyJubJub.eq(points.h2, h2Prime);
  }
}
