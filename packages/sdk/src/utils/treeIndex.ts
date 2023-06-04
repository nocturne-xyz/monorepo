import { TreeConstants } from "../primitives";
import { assertOrErr } from "./error";

// Merkle leaf index to start index of the it's corresponding batch
// E.g. merkleIndex 15 -> batchOffset 0, merkleIndex 28 -> batchOffset 16
export function merkleIndexToBatchOffset(merkleIndex: number): number {
  return merkleIndex - (merkleIndex % TreeConstants.BATCH_SIZE);
}

// Merkle leaf index to the index of the leaf's subtree root
// E.g. merkleIndex 15 -> subtreeIndex 0, merkleIndex 28 -> subtreeIndex 1
export function merkleIndexToSubtreeIndex(merkleIndex: number): number {
  return merkleIndexToBatchOffset(merkleIndex) / TreeConstants.BATCH_SIZE;
}

// Batch offset to the index of the rightmost leaf in that batch
// E.g. batchOffset 0 -> subtreeIndex 15, batchOffset 16 -> subtreeIndex 31
export function batchOffsetToLatestMerkleIndexInBatch(
  batchOffset: number
): number {
  assertOrErr(
    batchOffset % TreeConstants.BATCH_SIZE === 0,
    "batchOffset must be a multiple of TreeConstants.BATCH_SIZE"
  );
  return batchOffset + TreeConstants.BATCH_SIZE - 1;
}
