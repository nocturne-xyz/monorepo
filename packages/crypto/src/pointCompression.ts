import { AffinePoint, BabyJubJub } from "./BabyJubJub";

export type CompressedPoint = bigint;

const F = BabyJubJub.BaseField;
const SIGN_MASK = 1n << 254n;

const P_MINUS_1_OVER_2 = F.div(F.sub(F.ORDER, F.ONE), F.create(2n));
const MAX_COMPRESSED_VALUE = (F.ORDER - 1n) | SIGN_MASK;

export function compressPoint({ x, y }: AffinePoint<bigint>): bigint {
  if (x > P_MINUS_1_OVER_2) {
    return SIGN_MASK | y;
  } else {
    return y;
  }
}

export function decompressPoint(
  c: CompressedPoint
): AffinePoint<bigint> | undefined {
  if (c > MAX_COMPRESSED_VALUE) return undefined;

  // unpack sign bit and Y coordinate
  const sign = c & SIGN_MASK;
  const y = c & (SIGN_MASK - 1n);
  if (y >= F.ORDER) return undefined;

  // compute X^2 using curve equation
  const ySquared = F.sqr(y);
  const xSquared = F.div(
    F.sub(F.ONE, ySquared),
    F.sub(BabyJubJub.A, F.mul(BabyJubJub.D, ySquared))
  );

  // get X by computing square root
  // circuit-utils sqrt returns undefined if sqrt DNE (i.e. legendre symbol is -1)
  let x = F.sqrt(xSquared);

  // if sqrt does not exist, the encoding is invalid
  // if sqrt is 0 and sign is nonzero, the encoding is invalid
  if (x === undefined || (sign && F.eql(x, F.ZERO))) return undefined;

  // select the root whose sign matches the sign bit
  if (x > P_MINUS_1_OVER_2 !== (sign !== 0n)) {
    x = F.neg(x);
  }

  return { x, y };
}

// returns [sign, y]
export function decomposeCompressedPoint(
  c: CompressedPoint
): [boolean, bigint] {
  return [(c & SIGN_MASK) !== 0n, c & (SIGN_MASK - 1n)];
}
