import { Scalar } from "ffjavascript";
import { CanonAddress, NocturneAddressTrait } from "../crypto";
import { Note } from "../sdk/note";
import randomBytes from "randombytes";
import { babyjub, poseidon } from "circomlibjs";
import { NoteTransmission, SNARK_SCALAR_FIELD } from "../commonTypes";

// Encode a babyjub point to field
export function encodePoint(point: [bigint, bigint]): bigint {
  return point[0];
}

// Decode a babyjub point (on prime order subgroup) from an encoding
export function decodePoint(x: bigint): [bigint, bigint] {
  const F = babyjub.F;
  const x2 = F.mul(F.e(x), F.e(x));
  const ax2 = F.mul(babyjub.A, x2);
  const dx2 = F.mul(babyjub.D, x2);
  const y2 = F.div(F.sub(ax2, F.one), F.sub(dx2, F.one));
  const y = F.sqrt(y2);
  let point: [bigint, bigint] = [BigInt(x), BigInt(y)];
  if (!babyjub.inSubgroup(point)) {
    point = [point[0], mod_p(-point[1])];
  }
  return point;
}

export function mod_p(n: bigint): bigint {
  return ((n % SNARK_SCALAR_FIELD) + SNARK_SCALAR_FIELD) % SNARK_SCALAR_FIELD;
}

// Extended Euclidean algorithm
export function egcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (b == 0n) {
    return [1n, 0n, a];
  } else {
    const [x, y, d] = egcd(b, a % b);
    return [y, x - y * (a / b), d];
  }
}

/**
 * Generate note transmission for a receiver canonical address and
 * a note
 */
export function genNoteTransmission(
  addr: CanonAddress,
  note: Note
): NoteTransmission {
  const r_buf = randomBytes(Math.floor(256 / 8));
  const r = Scalar.fromRprBE(r_buf, 0, 32) % babyjub.subOrder;
  const R = babyjub.mulPointEscalar(babyjub.Base8, r);
  const encryptedNonce = mod_p(BigInt(poseidon([encodePoint(R)])) + note.nonce);
  const encryptedValue = mod_p(
    BigInt(poseidon([encodePoint(R) + 1n])) + note.value
  );
  return {
    owner: NocturneAddressTrait.randomize(note.owner),
    encappedKey: encodePoint(babyjub.mulPointEscalar(addr, r)),
    encryptedNonce,
    encryptedValue,
  };
}
