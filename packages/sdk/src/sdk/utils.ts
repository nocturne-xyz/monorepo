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
  let events: TypedEvent<T>[] = [];
  while (from < to) {
    let finalTo = Math.min(from + CHUNK_SIZE, to);
    try {
      const events = await contract.queryFilter(filter, from, finalTo);

      from = finalTo;
      events.push(...events);
    } catch (e) {
      throw e;
    }
  }

  return events;
}

export async function query<T extends Result, C extends BaseContract>(
  contract: C,
  filter: EventFilter,
  from: number,
  to: number
): Promise<TypedEvent<T>[]> {
  let events: TypedEvent<T>[] = [];
  if (from == 0 || to - from >= 10_000) {
    events = await largeQueryInChunks(contract, filter, from, to);
  } else {
    events = (await contract.queryFilter(filter, from, to)) as TypedEvent<T>[];
  }

  return events;
}
