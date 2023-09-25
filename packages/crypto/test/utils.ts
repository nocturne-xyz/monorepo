import "./crypto";

export function range(start: number, stop?: number, step?: number): number[] {
  if (!stop) {
    stop = start;
    start = 0;
  }

  step = step ?? 1;

  return Array(Math.ceil((stop - start) / step))
    .fill(start)
    .map((x, i) => x + i * (step as number));
}

export function unprefixedHexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    hex = "0" + hex;
  }

  const u8 = new Uint8Array(hex.length / 2);

  let i = 0;
  let j = 0;
  while (i < hex.length) {
    u8[i] = parseInt(hex.slice(j, j + 2), 16);
    i += 1;
    j += 2;
  }

  return u8;
}
