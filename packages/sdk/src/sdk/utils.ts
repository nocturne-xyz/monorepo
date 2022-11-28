import { TypedEvent } from "@flax/contracts/dist/src/common";
import { bigintToBuf } from "bigint-conversion";
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
export function splitBigint256ToLimbs(n: bigint, lowerBits: number): [bigint, bigint] {
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
  const res = [...new Uint8Array(bigintToBuf(n, true))];
  while (res.length < numBytes) {
    res.unshift(0);
  }

  return res;
}
