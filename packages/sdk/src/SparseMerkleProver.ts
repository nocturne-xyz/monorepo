import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { assertOrErr, zip } from "./utils";
import { poseidonBN } from "@nocturne-xyz/circuit-utils";
import { KVStore } from "./store";
import * as JSON from "bigint-json-serialization";

export interface TreeNode {
  left?: TreeNode;
  right?: TreeNode;
  hash: bigint;
}

export interface SMTDump {
  root: TreeNode;
  leaves: Array<[number, bigint]>;
  _count: number;
}

// (1 means right, 0 means left)
type PathIndex = 0 | 1;

const SMT_DUMP_KEY = "SMT_DUMP";
export const MAX_DEPTH: number = 32;

// TODO: turn these into constants
// ZERO_HASH[i] = root hash of empty merkle tree of depth i
export const ZERO_HASHES = [0n];
for (let i = 1; i <= MAX_DEPTH; i++) {
  ZERO_HASHES.push(poseidonBN([ZERO_HASHES[i - 1], ZERO_HASHES[i - 1]]));
}

export class SparseMerkleProver {
  private _count: number;
  private root: TreeNode;
  private leaves: Map<number, bigint>;
  private kv: KVStore;

  constructor(kv: KVStore) {
    this.root = {
      hash: ZERO_HASHES[0],
    };
    this.leaves = new Map();
    this._count = 0;
    this.kv = kv;
  }

  count(): number {
    return this._count;
  }

  insert(index: number, leaf: bigint, include: boolean = true): void {
    assertOrErr(index < 2 ** MAX_DEPTH, "index must be < 2^maxDepth");
    assertOrErr(index >= this._count, "index must be >= tree count");

    this.root = this.insertInner(this.root, [leaf], bitReverse(index));

    if (include) {
      this.leaves.set(index, leaf);
    }

    this._count = index + 1;
  }

  insertBatch(startIndex: number, leaves: bigint[], includes: boolean[]) {
    assertOrErr(startIndex < 2 ** MAX_DEPTH, "index must be < 2^maxDepth");
    assertOrErr(startIndex >= this._count, "index must be >= tree count");
    assertOrErr(
      leaves.length === includes.length,
      "leaves and includes must be the same length"
    );

    this.root = this.insertInner(this.root, [...leaves], bitReverse(startIndex));

    for (const [i, include] of includes.entries()) {
      if (include) {
        this.leaves.set(startIndex + i, leaves[i]);
      }
    }

    this._count = startIndex + leaves.length;
  }

  markForPruning(index: number): void {
    assertOrErr(this.leaves.has(index), "leaf is not in the tree");
    this.leaves.delete(index);
  }

  getProof(index: number): MerkleProof {
    assertOrErr(
      this.leaves.has(index),
      "leaf is not in the tree or it has been pruned"
    );
    const [siblings, pathIndices] = this.getSiblings(
      this.root,
      bitReverse(index)
    );

    return {
      root: this.root.hash,
      leaf: this.leaves.get(index)!,
      siblings,
      pathIndices,
    };
  }

  static verifyProof({
    root,
    leaf,
    siblings,
    pathIndices,
  }: MerkleProof): boolean {
    let currentRoot = leaf;

    for (const [sibling, pathIndex] of zip(siblings, pathIndices)) {
      assertOrErr(typeof sibling === "bigint", "invalid sibling");
      assertOrErr(typeof pathIndex === "number", "invalid pathIndex");
      assertOrErr(pathIndex === 0 || pathIndex === 1, "invalid pathindex");

      if (pathIndex === 0) {
        // path goes left
        currentRoot = poseidonBN([currentRoot, sibling]);
      } else {
        // path goes right
        currentRoot = poseidonBN([sibling, currentRoot]);
      }
    }

    return currentRoot === root;
  }

  prune(): void {
    this.pruneHelper(this.root, 0);
  }

  async persist(): Promise<void> {
    this.prune();

    const dump: SMTDump = {
      root: this.root,
      leaves: Array.from(this.leaves),
      _count: this._count,
    };
    await this.kv.putString(SMT_DUMP_KEY, JSON.stringify(dump));
  }

  static async loadFromKV(kv: KVStore): Promise<SparseMerkleProver> {
    const smt = new SparseMerkleProver(kv);
    const dumpStr = await kv.getString(SMT_DUMP_KEY);
    if (!dumpStr) {
      return smt;
    }

    const dump: SMTDump = JSON.parse(dumpStr);
    smt.root = dump.root;
    smt.leaves = new Map(dump.leaves);
    smt._count = dump._count;

    return smt;
  }

  // returns number of leaves in the subtree that we can't prune
  private pruneHelper(
    root: TreeNode,
    depth: number,
    index: number = 0
  ): number {
    // if we're at a leaf, the we can safely prune it if we'll never need it to generate a proof.
    // we'll need a leaf to generate a proof if:
    // 1. it's in the leaves map
    // 2. it's the sibling of a leaf in the leaves map
    // 3. it's the last leaf in the tree and the tree has an odd number of leaves
    //    (in this case, if we were to remove the last leaf, prune, and then append another leaf,
    //     we'd need the pruned leaf to generate a proof for the new leaf)
    // these cases are not mutually exclusive, but if at least one of them are true,
    // then we can't prune the leaf
    //
    // we can check the second case by checking the `leaves` map for the sibling of the current leaf, whose
    // index will be the current index with the least significant bit flipped
    if (
      depth === MAX_DEPTH &&
      (this.leaves.has(index) ||
        this.leaves.has(index ^ 1) ||
        (index === this._count - 1 && this._count % 2 === 1))
    ) {
      return 1;
    }

    // if we get here, two cases:
    // 1. we're at a leaf. if we are, then we can safely prune it because we passed previous checks
    // 2. we're at an internal node. if we are, recurse and count the number of leaves in our child trees we can't prune
    let leftCount = root.left
      ? this.pruneHelper(root.left, depth + 1, index << 1)
      : 0;
    let rightCount = root.right
      ? this.pruneHelper(root.right, depth + 1, (index << 1) + 1)
      : 0;

    // if there are no leaves in either of our child trees that we can't prune, then we can prune this node too
    if (leftCount + rightCount === 0) {
      root.left = undefined;
      root.right = undefined;
    }

    return leftCount + rightCount;
  }

  // returns [hashes, pathIndices]
  private getSiblings(
    root: TreeNode,
    pathMask: number,
    depth: number = 0
  ): [bigint[], PathIndex[]] {
    if (depth === MAX_DEPTH) {
      return [[], []];
    }

    if (pathMask & 1) {
      // path goes to the right => get the left sibling
      // `root.right` is guaranteed to exist because we checked `this.leaves.has(index)`
      const [siblings, pathIndices] = this.getSiblings(
        root.right!,
        pathMask >> 1,
        depth + 1
      );
      return [
        [...siblings, root.left?.hash ?? ZERO_HASHES[MAX_DEPTH - depth - 1]],
        [...pathIndices, 1],
      ];
    } else {
      // path goes to the left => get the right sibling
      // `root.left` is guaranteed to exist because we checked `this.leaves.has(index)`
      const [siblings, pathIndices] = this.getSiblings(
        root.left!,
        pathMask >> 1,
        depth + 1
      );
      return [
        [...siblings, root.right?.hash ?? ZERO_HASHES[MAX_DEPTH - depth - 1]],
        [...pathIndices, 0],
      ];
    }
  }

  private insertInner(
    root: TreeNode,
    leaves: bigint[],
    pathMask: number,
    depth: number = 0
  ): TreeNode {
    if (leaves.length === 0) return root;

    // we're at the leaf
    if (depth === MAX_DEPTH) {
      return { hash: leaves.shift()! };
    }

    // we're not at the leaf
    if (pathMask & 1) {
      // right
      root.right = this.insertInner(
        root.right ?? { hash: ZERO_HASHES[MAX_DEPTH - depth - 1]},
        leaves,
        pathMask >> 1,
        depth + 1
      );
    } else {
      // left
      root.left = this.insertInner(
        root.left ?? { hash: ZERO_HASHES[MAX_DEPTH - depth - 1]},
        leaves,
        pathMask >> 1,
        depth + 1
      );

      // if there are still leaves to insert, then continue to the right subtree
      if (leaves.length > 0) {
        root.right = this.fillLeft(
          root.right ?? {
            hash: ZERO_HASHES[MAX_DEPTH - depth - 1],
          },
          leaves,
          depth + 1
        );
      }
    }

    root.hash = poseidonBN([
      root.left?.hash ?? ZERO_HASHES[MAX_DEPTH - depth - 1],
      root.right?.hash ?? ZERO_HASHES[MAX_DEPTH - depth - 1],
    ]);

    return root;
  }

  // fill a subtree with leaves, starting from the left and stopping once we run out of leaves
  private fillLeft(root: TreeNode, leaves: bigint[], depth: number): TreeNode {
    if (leaves.length === 0) return root;

    if (depth === MAX_DEPTH) {
      return { hash: leaves.shift()! };
    }

    root.left = this.fillLeft(
      root.left ?? { hash: ZERO_HASHES[MAX_DEPTH - depth - 1] },
      leaves,
      depth + 1
    );

    // this branch is technically unnecessary
    // but we include it so that the structure that results from a batch insert
    // is the same as the structure that results from inserting one by one
    if (leaves.length > 0) {
      root.right = this.fillLeft(
        root.right ?? { hash: ZERO_HASHES[MAX_DEPTH - depth - 1] },
        leaves,
        depth + 1
      );
    }

    root.hash = poseidonBN([
      root.left?.hash ?? ZERO_HASHES[MAX_DEPTH - depth - 1],
      root.right?.hash ?? ZERO_HASHES[MAX_DEPTH - depth - 1],
    ]);

    return root;
  }
}

// a 32-bit bit-reversal
function bitReverse(x: number) {
  x = ((x >> 1) & 0x55555555) | ((x & 0x55555555) << 1);
  x = ((x >> 2) & 0x33333333) | ((x & 0x33333333) << 2);
  x = ((x >> 4) & 0x0f0f0f0f) | ((x & 0x0f0f0f0f) << 4);
  x = ((x >> 8) & 0x00ff00ff) | ((x & 0x00ff00ff) << 8);
  x = (x >>> 16) | (x << 16);

  return x >>> 0;
}
