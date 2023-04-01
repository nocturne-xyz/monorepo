import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { assertOrErr, max, range, zip } from "./utils";
import { poseidonBN } from "@nocturne-xyz/circuit-utils";
import { KVStore } from "./store";

export interface TreeNode {
  left?: TreeNode;
  right?: TreeNode;
  hash: bigint;
  dirty: boolean;
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
      dirty: false,
    };
    this.leaves = new Map();
    this._count = 0;
    this.kv = kv;
  }

  count(): number {
    return this._count;
  }

  insert(index: number, leaf: bigint, include: boolean = true): void {
    assertOrErr(index < (2**MAX_DEPTH), "index must be < 2^maxDepth");
    assertOrErr(index >= this._count, "index must be >= tree count");

    this.root = this.insertInner(this.root, toBitsBE(index), leaf);

    if (include) {
      this.leaves.set(index, leaf);
    }

    this._count = max(this._count, index + 1);
  }

  getProof(index: number): MerkleProof {
    assertOrErr(
      this.leaves.has(index),
      "leaf is not in the tree or it has been pruned"
    );
    const [siblings, pathIndices] = this.getSiblings(this.root, toBitsBE(index));

    return {
      root: this.root.hash,
      leaf: this.leaves.get(index)!,
      siblings,
      pathIndices,
    };
  }

  static verifyProof({ root, leaf, siblings, pathIndices }: MerkleProof): boolean {
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

  // returns number of 'included' leaves in the subtree
  private pruneHelper(root: TreeNode, depth: number, index: number = 0): number {
    // if the current hasn't been changed, then we can safely assume it's been pruned already
    if (!root.dirty) {
      return 1;
    }

    // if we're at a leaf, the we can safely prune it if we'll never need it to generate a proof.
    // we'll need a leaf to generate a proof if:
    // 1. it's in the leaves map
    // 2. it's the sibling of a leaf in the leaves map (
    // these two cases are not mutually exclusive, but if at least one of them are true,
    // then we can't prune the leaf
    //
    // we can check the second case by checking the `leaves` map for the sibling of the current leaf, whose
    // index will be the current index with the least significant bit flipped
    if (depth === MAX_DEPTH && (this.leaves.has(index) || this.leaves.has(index ^ 1))) {
      root.dirty = false;
      return 1;
    }

    // if we're at a leaf here, then we can safely prune it
    let leftCount = root.left ? this.pruneHelper(root.left, depth + 1, index << 1) : 0;
    let rightCount = root.right ? this.pruneHelper(root.right, depth + 1, (index << 1) + 1) : 0;

    if (leftCount + rightCount === 0) {
      root.dirty = false;
      root.left = undefined;
      root.right = undefined;
    }

    return leftCount + rightCount;
  }

  // returns [hashes, pathIndices]
  private getSiblings(
    root: TreeNode,
    path: boolean[],
  ): [bigint[], PathIndex[]] {
    if (path.length === 0) {
      return [[], []];
    }

    const [head, ...tail] = path;
    if (head) {
      // path goes to the right => get the left sibling
      // `root.right` is guaranteed to exist because we checked `this.leaves.has(index)`
      const [siblings, pathIndices] = this.getSiblings(
        root.right!,
        tail,
      );
      return [
        [...siblings, root.left?.hash ?? ZERO_HASHES[path.length - 1]],
        [...pathIndices, 1],
      ];
    } else {
      // path goes to the left => get the right sibling
      // `root.left` is guaranteed to exist because we checked `this.leaves.has(index)`
      const [siblings, pathIndices] = this.getSiblings(
        root.left!,
        tail,
      );
      return [
        [...siblings, root.right?.hash ?? ZERO_HASHES[path.length - 1]],
        [...pathIndices, 0],
      ];
    }
  }

  private insertInner(
    root: TreeNode,
    path: boolean[],
    leaf: bigint,
  ): TreeNode {
    // we're at the leaf
    if (path.length === 0) {
      return { hash: leaf, dirty: true };
    }

    const [head, ...tail] = path;

    // we're not at the leaf
    if (head) {
      // right
      root.right = this.insertInner(
        root.right ?? { hash: ZERO_HASHES[path.length - 1], dirty: true },
        tail,
        leaf,
      );
    } else {
      // left
      root.left = this.insertInner(
        root.left ?? { hash: ZERO_HASHES[path.length - 1], dirty: true},
        tail,
        leaf,
      );
    }

    root.dirty = (root.left?.dirty ?? false) || (root.right?.dirty ?? false);
    root.hash = poseidonBN([
      root.left?.hash ?? ZERO_HASHES[path.length - 1],
      root.right?.hash ?? ZERO_HASHES[path.length - 1],
    ]);

    return root;
  }
}

function toBitsBE(x: number): boolean[] {
  return range(MAX_DEPTH).map(i => ((x >> i) & 1) !== 0).reverse();
}
