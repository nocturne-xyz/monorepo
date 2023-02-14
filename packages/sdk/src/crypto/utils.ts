import { CanonAddress, StealthAddressTrait } from "../crypto";
import { Note } from "../sdk/note";
import randomBytes from "randombytes";
import { AffinePoint, BabyJubJub, poseidonBN } from "@nocturne-xyz/circuit-utils";
import { EncryptedNote } from "../commonTypes";
import { assert } from "../sdk";

const F = BabyJubJub.BaseField;
const Fr = BabyJubJub.ScalarField;

const BIGINT_BYTES = 8;

// Encode a babyjub point to field
export function encodePoint(point: AffinePoint<bigint>): bigint {
  return point.x;
}

// Decode a babyjub point (on prime order subgroup) from an encoding
export function decodePoint(x: bigint): AffinePoint<bigint> {
  const x2 = F.mul(F.reduce(x), F.reduce(x));
  const ax2 = F.mul(BabyJubJub.A, x2);
  const dx2 = F.mul(BabyJubJub.D, x2);
  const y2 = F.div(F.sub(ax2, F.One), F.sub(dx2, F.One));
  const y = F.sqrt(y2);
  assert(y !== undefined, "invalid point encoding");

  let point: AffinePoint<bigint> = { x, y: y! };
  // console.log("point", point);
  
  if (!BabyJubJub.isInSubgroup(point)) {
    point = BabyJubJub.neg(point);
  }

  return point;
}

export function randomBigInt(): bigint {
  const rand = randomBytes(BIGINT_BYTES);
  return BigInt("0x" + rand.toString("hex"));
}

/**
 * Encrypt a note sent to a given receiver's
 */
export function encryptNote(addr: CanonAddress, note: Note): EncryptedNote {
  const r_buf = randomBytes(Math.floor(256 / 8));
  const r = Fr.fromBytes(r_buf);
  const R = BabyJubJub.scalarMul(BabyJubJub.BasePoint, r);

  const encryptedNonce = F.add(poseidonBN([encodePoint(R)]), F.reduce(note.nonce));
  const encryptedValue = F.add(
    poseidonBN([F.reduce(encodePoint(R) + F.One)]),
    F.reduce(note.value)
  );
  
  return {
    owner: StealthAddressTrait.randomize(note.owner),
    encappedKey: encodePoint(BabyJubJub.scalarMul(addr, r)),
    encryptedNonce,
    encryptedValue,
  };
}
