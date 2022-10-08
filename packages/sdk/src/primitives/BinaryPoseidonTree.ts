import {
  IncrementalMerkleTree,
  Node,
  MerkleProof,
} from "@zk-kit/incremental-merkle-tree";
import { poseidon } from "circomlibjs";

export class BinaryPoseidonTree {
  static readonly DEPTH = 32;

  tree: IncrementalMerkleTree;
  count: number;

  constructor() {
    this.tree = new IncrementalMerkleTree(
      poseidon,
      BinaryPoseidonTree.DEPTH,
      BigInt(0)
    );
    this.count = 0;
  }

  insert(leaf: Node): void {
    this.tree.insert(leaf);
    this.count += 1;
  }

  createProof(index: number): MerkleProof {
    return this.tree.createProof(index);
  }
}
