import { TypedEvent } from "@flax/contracts/dist/src/common";
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
  while (from < to) {
    const finalTo = Math.min(from + CHUNK_SIZE, to);
    const rangeEvents = await contract.queryFilter(filter, from, finalTo);
    from = finalTo;
    events.push(...(rangeEvents as TypedEvent<T>[]));
  }

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

export function bigInt256ToBEBytes(n: bigint): number[] {
  let s = n.toString(16);

  // pad with leading zeros
  while (s.length < 64) {
    s = "0" + s;
  }

  return hexStringToBEBytes(s);
}

export function bEBytesToBigInt256(bytes: number[]): bigint {
  while (bytes.length < 32) {
    bytes.unshift(0);
  }

  return bytes.reduce((acc, byte) => {
    return acc * 256n + BigInt(byte);
  }, 0n);
}

export function hexStringToBEBytes(s: string): number[] {
  const res = [];
  for (let i = 0; i < 32; i++) {
    const byte = parseInt(s.slice(2*i, 2*(i+1)), 16);
    res.push(byte);
  }

  return res;
}

export function splitBigInt256(n: bigint): [number, bigint] {
  let bits = n.toString(2);

  // pad with leading zeros
  while (bits.length < 256) {
    bits = "0" + bits;
  }
  
  const hi = parseInt(bits.slice(0, 3), 2);
  const lo = BigInt(`0b${bits.slice(3)}`);

  return [hi, lo];
}
