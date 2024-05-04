import {
  OperationTrait,
  Operation,
  SubmittableOperationWithNetworkInfo,
} from ".";

// Numbers and logic copied from contracts Types.sol
// Only exception is an extra 100k gas buffer for safety
export const BLOCK_GAS_LIMIT = 30_000_000n;
const GAS_PER_JOINSPLIT_VERIFY_SINGLE = 300_000n; // assumes batch size = 1
const GAS_PER_JOINSPLIT_HANDLE = 110_000n;
const GAS_PER_INSERTION_SUBTREE_UPDATE = 25_000n;
const GAS_PER_INSERTION_ENQUEUE = 25_000n;
const GAS_PER_OPERATION_MISC = 100_000n;
const GAS_BUFFER = 100_000n; // TODO: tune

// etherscan shows typical deposit ~182600 gas
export const GAS_PER_DEPOSIT_COMPLETE = 185_000n;

interface GasCompensationParams {
  executionGasLimit: bigint;
  numJoinSplits: number;
  numUniqueAssets: number;
}

export function maxGasForOperation(
  op: Operation | SubmittableOperationWithNetworkInfo
): bigint {
  let numJoinSplits: number;
  let numUniqueAssets: number;
  if ("trackedAssets" in op) {
    numJoinSplits = op.pubJoinSplits.length + op.confJoinSplits.length;
    numUniqueAssets = op.trackedAssets.length;
  } else {
    numJoinSplits = op.joinSplits.length;
    numUniqueAssets = OperationTrait.getTrackedAssets(op).length;
  }

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
  const res =
    executionGasLimit +
    (GAS_PER_JOINSPLIT_VERIFY_SINGLE + GAS_PER_JOINSPLIT_HANDLE) *
      BigInt(numJoinSplits) +
    (GAS_PER_INSERTION_SUBTREE_UPDATE + GAS_PER_INSERTION_ENQUEUE) *
      BigInt(numUniqueAssets + numJoinSplits * 2) +
    GAS_PER_OPERATION_MISC +
    GAS_BUFFER;

  // TODO gas estimation report system
  if (process?.env?.DEBUG) {
    console.log(
      `Gas compensation equation:
        ${executionGasLimit} (exectuion gas limit)
        + (${
          GAS_PER_JOINSPLIT_VERIFY_SINGLE + GAS_PER_JOINSPLIT_HANDLE
        }) (gas per joinsplit assuming no batch) * ${numJoinSplits} (numJoinSplits)
        + (${
          GAS_PER_INSERTION_SUBTREE_UPDATE + GAS_PER_INSERTION_ENQUEUE
        }) (gas per insertion) * (${numUniqueAssets} (num unique assets) + ${
        2 * numJoinSplits
      } (num joinsplits x 2))
        + ${GAS_PER_OPERATION_MISC} (misc costs in contract, magic number)
        + ${GAS_BUFFER} (buffer)
        = ${res} (total gas estimate)`
    );
  }

  return res;
}
