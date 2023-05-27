import { JoinSplitRequest } from "../operationRequest";
import { Note } from "../primitives";

export function sortNotesByValue<T extends Note>(notes: T[]): T[] {
  return notes.sort((a, b) => {
    return Number(a.value - b.value);
  });
}

export function getJoinSplitRequestTotalValue(
  joinSplitRequest: JoinSplitRequest
): bigint {
  let totalVal = joinSplitRequest.unwrapValue;
  if (joinSplitRequest.payment !== undefined) {
    totalVal += joinSplitRequest.payment.value;
  }
  return totalVal;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function merklePathToIndex(
  pathIndices: bigint[],
  direction: "ROOT_TO_LEAF" | "LEAF_TO_ROOT"
): bigint {
  if (direction === "LEAF_TO_ROOT") {
    pathIndices = [...pathIndices].reverse();
  }

  return pathIndices.reduce(
    (idx, pathIndex) => (idx << 2n) | BigInt(pathIndex),
    0n
  );
}
