import { BN254ScalarField } from "@nocturne-xyz/circuit-utils";
import { ethers } from "ethers";

export const ARITY = 4;
export const DEPTH = 16;
export const SUBTREE_DEPTH = 2;
export const BATCH_SIZE = ARITY ** SUBTREE_DEPTH;
export const DEPTH_TO_SUBTREE = DEPTH - SUBTREE_DEPTH;
// keccak256("nocturne") % p
export const ZERO_VALUE = BN254ScalarField.reduce(
  BigInt(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nocturne")))
);
