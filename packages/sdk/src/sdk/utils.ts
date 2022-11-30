import { TypedEvent } from "@nocturne-xyz/contracts/dist/src/common";
import { BaseContract, EventFilter } from "ethers";
import { Result } from "ethers/lib/utils";

const CHUNK_SIZE = 2000;

export async function largeQueryInChunks<T extends Result>(
  contract: BaseContract,
  filter: EventFilter,
  from: number,
  to: number
): Promise<TypedEvent<T>[]> {
  const events: TypedEvent<T>[] = [];
  do {
    const finalTo = Math.min(from + CHUNK_SIZE, to);
    const rangeEvents = await contract.queryFilter(filter, from, finalTo);
    from = finalTo;
    events.push(...(rangeEvents as TypedEvent<T>[]));
  } while (from < to);

  return events;
}

export async function query<T extends Result, C extends BaseContract>(
  contract: C,
  filter: EventFilter,
  from: number,
  to: number
): Promise<TypedEvent<T>[]> {
  return largeQueryInChunks(contract, filter, from, to);
}

// splits bigint256 into two limbs, where the lower limb has `lowerBits` bits
export function splitBigint256ToLimbs(
  n: bigint,
  lowerBits: number
): [bigint, bigint] {
  n = BigInt.asUintN(256, n);

  const hi = n >> BigInt(lowerBits);
  const lo = n & ((1n << BigInt(lowerBits)) - 1n);
  return [hi, lo];
}

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

export function bigintToBuf(bn: bigint): Uint8Array {
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

// Extended Euclidean algorithm
export function egcd(
  a: bigint,
  b: bigint
): [bigint, bigint, bigint] {
  if (b == 0n) {
    return [1n, 0n, a];
  } else {
    const [x, y, d] = egcd(b, a % b);
    return [y, x - y * (a / b), d];
  }
}
