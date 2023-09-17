export function assert(cond: boolean, msg?: string): void {
  if (!cond) throw new Error(msg);
}

// RFC 3447 - compliant I2OSP
// converts a non-negative bigint to a big-endian byte string of length `length`
export function i2osp(n: bigint, length: number): Uint8Array {
  if (n < 0n) {
    throw new Error("i2osp: input must be non-negative");
  }

  if (n > 256 ** length) {
    throw new Error(
      "i2osp: input too large to encode into a byte array of specified length"
    );
  }

  const bytes = new Uint8Array(length);

  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(n & 0xffn);
    n >>= 8n;
  }

  return bytes;
}
