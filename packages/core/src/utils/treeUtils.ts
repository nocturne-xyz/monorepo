import { BN254ScalarField } from "@nocturne-xyz/crypto";
import { ethers } from "ethers";
import { assertOrErr } from "./error";

const ARITY = 4;
const DEPTH = 16;
const SUBTREE_DEPTH = 2;
const BATCH_SIZE = ARITY ** SUBTREE_DEPTH;
const DEPTH_TO_SUBTREE = DEPTH - SUBTREE_DEPTH;

export const TreeConstants = {
  ARITY,
  DEPTH,
  SUBTREE_DEPTH,
  BATCH_SIZE,
  DEPTH_TO_SUBTREE,
}:

// Merkle leaf index to start index of the it's corresponding batch
// E.g. merkleIndex 15 -> batchOffset 0, merkleIndex 28 -> batchOffset 16
export function merkleIndexToBatchOffset(merkleIndex: number): number {
  return merkleIndex - (merkleIndex % BATCH_SIZE);
}

// Merkle leaf index to the index of the leaf's subtree root
// E.g. merkleIndex 15 -> subtreeIndex 0, merkleIndex 28 -> subtreeIndex 1
export function merkleIndexToSubtreeIndex(merkleIndex: number): number {
  return merkleIndexToBatchOffset(merkleIndex) / BATCH_SIZE;
}

// Batch offset to the index of the rightmost leaf in that batch
// E.g. batchOffset 0 -> subtreeIndex 15, batchOffset 16 -> subtreeIndex 31
export function batchOffsetToLatestMerkleIndexInBatch(
  batchOffset: number
): number {
  assertOrErr(
    batchOffset % BATCH_SIZE === 0,
    "batchOffset must be a multiple of TreeConstants.BATCH_SIZE"
  );
  return batchOffset + BATCH_SIZE - 1;
}


// keccak256("nocturne") % BN254ScalarField.Modulus
export const ZERO_VALUE = BN254ScalarField.create(
  BigInt(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nocturne")))
);

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