import { getTrackedAssets } from "./operation";
import { Operation } from "./types";

// Numbers and logic copied from contracts Types.sol
const GAS_PER_JOINSPLIT_VERIFY_SINGLE = 290_000n;
const GAS_PER_JOINSPLIT_HANDLE = 120_000n;
const GAS_PER_INSERTION_SUBTREE_UPDATE = 25_000n;
const GAS_PER_INSERTION_ENQUEUE = 25_000n;
const GAS_PER_OPERATION_MISC = 90_000n;
const GAS_BUFFER = 100_000n;

export function maxGasLimitForOperation(op: Operation): bigint {
  const numJoinSplits = op.joinSplits.length;
  const numUniqueAssets = getTrackedAssets(op).length;

  return BigInt(
    op.executionGasLimit +
      (GAS_PER_JOINSPLIT_VERIFY_SINGLE + GAS_PER_JOINSPLIT_HANDLE) *
        BigInt(numJoinSplits) +
      (GAS_PER_INSERTION_SUBTREE_UPDATE + GAS_PER_INSERTION_ENQUEUE) *
        BigInt(numUniqueAssets + numJoinSplits * 2) +
      GAS_PER_OPERATION_MISC +
      GAS_BUFFER
  );
}

export function maxGasLimitForSingleJoinSplit(): bigint {
  return (
    GAS_PER_JOINSPLIT_VERIFY_SINGLE +
    GAS_PER_JOINSPLIT_HANDLE +
    3n * (GAS_PER_INSERTION_SUBTREE_UPDATE + GAS_PER_INSERTION_ENQUEUE) // 2 new NCs + refund
  );
}
