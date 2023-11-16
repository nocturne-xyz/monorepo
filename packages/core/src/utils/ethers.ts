import { TypedEvent } from "@nocturne-xyz/contracts/dist/src/common";
import {
  BaseContract,
  EventFilter,
  ContractReceipt,
  Event,
  ethers,
} from "ethers";
import {
  Result,
  EventFragment,
  Interface,
  LogDescription,
} from "ethers/lib/utils";
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

export function parseEventsFromTransactionReceipt(
  receipt: ethers.providers.TransactionReceipt,
  contractInterface: Interface, // This is the Interface object of your contract
  eventFragment: EventFragment
): LogDescription[] {
  return receipt.logs
    .map((log) => tryParseLog(log, contractInterface))
    .filter(
      (event) =>
        event && event !== null && event.signature === eventFragment.format()
    )
    .map((event) => event!);
}

// Helper function to safely parse a log entry
function tryParseLog(log: ethers.providers.Log, contractInterface: Interface) {
  try {
    return contractInterface.parseLog(log);
  } catch {
    // Log could not be parsed (maybe it's not an event of the provided interface)
    console.log("Could not parse log", log);
    return null;
  }
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
