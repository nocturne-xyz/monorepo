import { getTrackedAssets } from "./operation";
import { Operation } from "./types";

// Numbers and logic copied from contracts Types.sol
const GAS_PER_JOINSPLIT_VERIFY_SINGLE = 300_000n;
const GAS_PER_JOINSPLIT_HANDLE = 110_000n;
const GAS_PER_INSERTION_SUBTREE_UPDATE = 25_000n;
const GAS_PER_INSERTION_ENQUEUE = 25_000n;
const GAS_PER_OPERATION_MISC = 100_000n;
const GAS_BUFFER = 200_000n;

export function maxGasForOperation(op: Operation): bigint {
  const numJoinSplits = op.joinSplits.length;
  const numUniqueAssets = getTrackedAssets(op).length;

  return (
    op.executionGasLimit +
    (GAS_PER_JOINSPLIT_VERIFY_SINGLE + GAS_PER_JOINSPLIT_HANDLE) *
      BigInt(numJoinSplits) +
    (GAS_PER_INSERTION_SUBTREE_UPDATE + GAS_PER_INSERTION_ENQUEUE) *
      BigInt(numUniqueAssets + numJoinSplits * 2) +
    GAS_PER_OPERATION_MISC +
    GAS_BUFFER
  );
}

export function maxGasForAdditionalJoinSplit(): bigint {
  return (
    GAS_PER_JOINSPLIT_VERIFY_SINGLE +
    GAS_PER_JOINSPLIT_HANDLE +
    3n * (GAS_PER_INSERTION_SUBTREE_UPDATE + GAS_PER_INSERTION_ENQUEUE) // 2 new NCs + refund
  );
}
