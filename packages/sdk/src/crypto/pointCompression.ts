import { AffinePoint, BabyJubJub } from "@nocturne-xyz/circuit-utils";

export type CompressedPoint = bigint;

const F = BabyJubJub.BaseField;
const SIGN_MASK = 1n << 254n;

const P_MINUS_1_OVER_2 = F.div(F.sub(F.Modulus, F.One), F.Two);
const MAX_COMPRESSED_VALUE = (F.Modulus - 1n) | SIGN_MASK;

export function compressPoint({ x, y }: AffinePoint<bigint>): bigint {
  if (x > P_MINUS_1_OVER_2) {
    return SIGN_MASK | y;
  } else {
    return y;
  }
}

export function decompressPoint(c: bigint): AffinePoint<bigint> | undefined {
  if (c > MAX_COMPRESSED_VALUE) return undefined;

  // unpack sign bit and Y coordinate
  const sign = c & SIGN_MASK;
  const y = c & (SIGN_MASK - 1n);
  if (y >= F.Modulus) return undefined;

  // compute X^2 using curve equation
  const ySquared = F.square(y);
  const xSquared = F.div(
    F.sub(F.One, ySquared),
    F.sub(BabyJubJub.A, F.mul(BabyJubJub.D, ySquared))
  );

  // get X by computing square root
  // circuit-utils sqrt returns undefined if sqrt DNE (i.e. legendre symbol is -1)
  let x = F.sqrt(xSquared);

  // if sqrt does not exist, the encoding is invalid
  // if sqrt is 0 and sign is nonzero, the encoding is invalid
  if (x === undefined || (sign && F.eq(x, F.Zero))) return undefined;

  // select the root whose sign matches the sign bit
  if (x > P_MINUS_1_OVER_2 !== (sign !== 0n)) {
    x = F.neg(x);
  }

  return { x, y };
}
