import { TypedEvent } from "@nocturne-xyz/contracts/dist/src/common";
import { BaseContract, ContractReceipt, Event, EventFilter } from "ethers";
import { EventFragment, Result } from "ethers/lib/utils";

const CHUNK_SIZE = 2000;

export async function queryEvents<T extends Result, C extends BaseContract>(
  contract: C,
  filter: EventFilter,
  from: number,
  to: number
): Promise<TypedEvent<T>[]> {
  return largeQueryInChunks(contract, filter, from, to);
}

export function parseEventsFromContractReceipt(
  receipt: ContractReceipt,
  eventFragment: EventFragment
): Event[] {
  return receipt.events!.filter((e) => {
    return e.eventSignature == eventFragment.format();
  });
}

async function largeQueryInChunks<T extends Result>(
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
