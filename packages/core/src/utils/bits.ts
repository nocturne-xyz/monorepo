// splits bigint256 into two limbs, where the lower limb has 253 bits and the upper limb has only 3.
export function bigInt256ToFieldElems(n: bigint): [bigint, bigint] {
  return splitBigint256ToLimbs(n, 253);
}

// converts a bigint256 into a 32-byte buffer containing it's big-endian repr
export function bigintToBEPadded(n: bigint, numBytes: number): number[] {
  const res = [...bigintToBuf(n)];
  while (res.length < numBytes) {
    res.unshift(0);
  }

  return res;
}

export function bigintFromBEBytes(buf: Uint8Array): bigint {
  let hex = "0x";
  for (let i = 0; i < buf.length; i++) {
    hex += buf[i].toString(16).padStart(2, "0");
  }

  return BigInt(hex);
}

// splits bigint256 into two limbs, where the lower limb has `lowerBits` bits
function splitBigint256ToLimbs(n: bigint, lowerBits: number): [bigint, bigint] {
  n = BigInt.asUintN(256, n);

  const hi = n >> BigInt(lowerBits);
  const lo = n & ((1n << BigInt(lowerBits)) - 1n);
  return [hi, lo];
}

function bigintToBuf(bn: bigint): Uint8Array {
  let hex = BigInt(bn).toString(16);
  if (hex.length % 2) {
    hex = "0" + hex;
  }

  const len = hex.length / 2;
  const u8 = new Uint8Array(len);

  let i = 0;
  let j = 0;
  while (i < len) {
    u8[i] = parseInt(hex.slice(j, j + 2), 16);
    i += 1;
    j += 2;
  }

  return u8;
}
