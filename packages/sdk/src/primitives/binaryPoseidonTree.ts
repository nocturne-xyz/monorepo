import {
  IncrementalMerkleTree,
  Node,
  MerkleProof,
} from "@zk-kit/incremental-merkle-tree";
import { poseidon } from "circomlibjs";

export class BinaryPoseidonTree {
  static readonly R = 28;
  static readonly S = 4;
  static readonly DEPTH = 32;
  static readonly SUBTREE_SIZE = 1 << this.S;

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  root(): any {
    return this.tree.root;
  }

  insert(leaf: Node): void {
    this.tree.insert(leaf);
    this.count += 1;
  }

  getProof(index: number): MerkleProof {
    return this.tree.createProof(index);
  }

  insertSubtree(leaves: Node[]): void {
    while (leaves.length < BinaryPoseidonTree.SUBTREE_SIZE) {
      leaves.push(0n);
    }

    for (let i = 0; i < BinaryPoseidonTree.SUBTREE_SIZE; i++) {
      this.insert(leaves[i]);
    }
  }

  // these methods are a bit of a hack
  // only the subtree updater should use them

  _insertEmptySubtree(): void {
    for (let i = 0; i < BinaryPoseidonTree.SUBTREE_SIZE; i++) {
      this.insert(0n);
    }
  }
  _insertNonEmptySubtree(leaves: Node[]): void {
    while (leaves.length < BinaryPoseidonTree.SUBTREE_SIZE) {
      leaves.push(0n);
    }

    const offset = this.count - BinaryPoseidonTree.SUBTREE_SIZE;
    for (let i = 0; i < BinaryPoseidonTree.SUBTREE_SIZE; i++) {
      this.tree.update(offset + i, leaves[i]);
    }
  }
}
