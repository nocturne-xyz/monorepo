import { getTrackedAssets } from "./operation";
import { Operation } from "./types";

// Numbers and logic copied from contracts Types.sol
const GAS_PER_JOINSPLIT_VERIFY_SINGLE = 300_000n;
const GAS_PER_JOINSPLIT_HANDLE = 110_000n;
const GAS_PER_INSERTION_SUBTREE_UPDATE = 25_000n;
const GAS_PER_INSERTION_ENQUEUE = 25_000n;
const GAS_PER_OPERATION_MISC = 100_000n;
const GAS_BUFFER = 200_000n;

interface GasCompensationParams {
  executionGasLimit: bigint;
  numJoinSplits: number;
  numUniqueAssets: number;
}

export function maxGasForOperation(op: Operation): bigint {
  const numJoinSplits = op.joinSplits.length;
  const numUniqueAssets = getTrackedAssets(op).length;

  return gasCompensationForParams({
    executionGasLimit: op.executionGasLimit,
    numJoinSplits,
    numUniqueAssets,
  });
}

export function gasCompensationForParams({
  executionGasLimit,
  numJoinSplits,
  numUniqueAssets,
}: GasCompensationParams): bigint {
  console.log(
    `Gas compensation equation: ${executionGasLimit} + (${GAS_PER_JOINSPLIT_VERIFY_SINGLE} + ${GAS_PER_JOINSPLIT_HANDLE}) * BigInt(${numJoinSplits}) + (${GAS_PER_INSERTION_SUBTREE_UPDATE} + ${GAS_PER_INSERTION_ENQUEUE}) * BigInt(${numUniqueAssets} + ${numJoinSplits} * 2) + ${GAS_PER_OPERATION_MISC} + ${GAS_BUFFER}`
  );

  return (
    executionGasLimit +
    (GAS_PER_JOINSPLIT_VERIFY_SINGLE + GAS_PER_JOINSPLIT_HANDLE) *
      BigInt(numJoinSplits) +
    (GAS_PER_INSERTION_SUBTREE_UPDATE + GAS_PER_INSERTION_ENQUEUE) *
      BigInt(numUniqueAssets + numJoinSplits * 2) +
    GAS_PER_OPERATION_MISC +
    GAS_BUFFER
  );
}

export const MAX_GAS_FOR_ADDITIONAL_JOINSPLIT =
  GAS_PER_JOINSPLIT_VERIFY_SINGLE +
  GAS_PER_JOINSPLIT_HANDLE +
  3n * (GAS_PER_INSERTION_SUBTREE_UPDATE + GAS_PER_INSERTION_ENQUEUE); // 2 new NCs + refund
