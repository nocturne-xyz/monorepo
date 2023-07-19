import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { assertOrErr, zip } from "./utils";
import { poseidonBN } from "@nocturne-xyz/crypto-utils";
import { KVStore } from "./store";
import * as JSON from "bigint-json-serialization";
import {
  consecutiveChunks,
  omitIndices,
  partition,
  range,
} from "./utils/functional";
import { ZERO_VALUE, DEPTH, ARITY } from "./primitives/treeConstants";

// high level idea:
// want to sync a local replica of the tree such that
// 1. we avoid loading the whole tree into memory at once
// 2. we avoid iterating over all of the leaves
// 3. we avoid storing the whole tree persistently
// 4. all of the above hold in snap, where storage is a single value
//    (ie we have to serialize all persistent state into single object and get/set that)
//
// `SparseMerkleProver` works as follows:
// 1. Start with a basic, naive merkle tree implementation with monotonic,
//    batch insert and point removals
// 2. Then, add a `leaves` map containing only the leaves that we want to be
//    able to prove membership for
// 3. Add a `prune` method that removes every node from the tree that isn't
//    necessary for proving membership of a leaf in `leaves`
//
// then, the course of operation goes like this:
// 1. pull new leaves from chain and `insert` them into the tree.
//    set `include` to `true` if we expect to prove membership for it later,
//    `false` otherwise
// 2. "nullify" leaves we no longer expect to prove membership for by calling
//    `markForPruning`
// 3. when we're done modifying the tree, call `prune` to remove all unnecessary nodes
// 4. later, we can generate proofs for leaves in `leaves` by calling `genProof`
//
// this way, all of the above properties are satisified - we only store / load into memory
// the minimum possible amount of information (astymptotically at least) and we never
// have to iterate over all leaves.

export interface TreeNode {
  children: (TreeNode | undefined)[];
  hash: bigint;
}

export interface SMTDump {
  root: TreeNode;
  leaves: Array<[number, bigint]>;
  uncommittedLeaves: UncommittedLeaf[];
  _count: number;
}

interface UncommittedLeaf {
  index: number;
  leaf: bigint;
  include: boolean;
}

// (0 means left, 1 means right)
type PathIndex = number;

const SMT_DUMP_KEY = "SMT_DUMP";

// TODO: turn these into constants
// ZERO_HASH[i] = root hash of empty merkle tree of depth i
export const ZERO_HASHES = [ZERO_VALUE];
for (let i = 1; i <= DEPTH; i++) {
  ZERO_HASHES.push(poseidonBN(new Array(ARITY).fill(ZERO_HASHES[i - 1])));
}

const NO_CHILDREN = new Array(ARITY).fill(undefined);

function zeroHashAtDepth(depth: number): bigint {
  return ZERO_HASHES[DEPTH - depth - 1];
}

function emptyNode(depth: number): TreeNode {
  return { hash: zeroHashAtDepth(depth), children: [...NO_CHILDREN] };
}

export class SparseMerkleProver {
  private _count: number;
  private root: TreeNode;
  private leaves: Map<number, bigint>;
  private uncommittedLeaves: UncommittedLeaf[];
  private kv: KVStore;

  constructor(kv: KVStore) {
    this.root = {
      children: [...NO_CHILDREN],
      hash: ZERO_HASHES[DEPTH],
    };
    this.leaves = new Map();
    this.uncommittedLeaves = [];
    this._count = 0;
    this.kv = kv;
  }

  getRoot(): bigint {
    return this.root.hash;
  }

  count(): number {
    return this._count;
  }

  insert(index: number, leaf: bigint, include = true): void {
    assertOrErr(index < ARITY ** DEPTH, `index must be < ${ARITY}^maxDepth`);
    assertOrErr(index >= this._count, "index must be >= tree count");

    this.root = this.insertInner(this.root, [leaf], pathIndexReverse(index));

    if (include) {
      this.leaves.set(index, leaf);
    }

    this._count = index + 1;
  }

  insertBatch(startIndex: number, leaves: bigint[], includes: boolean[]): void {
    assertOrErr(
      startIndex + leaves.length < ARITY ** DEPTH,
      `index must be < ${ARITY}^maxDepth`
    );
    assertOrErr(startIndex >= this._count, "index must be >= tree count");
    assertOrErr(
      leaves.length === includes.length,
      "leaves and includes must be the same length"
    );

    this.root = this.insertInner(
      this.root,
      [...leaves],
      pathIndexReverse(startIndex)
    );

    for (const [i, include] of includes.entries()) {
      if (include) {
        this.leaves.set(startIndex + i, leaves[i]);
      }
    }

    this._count = startIndex + leaves.length;
  }

  insertUncommitted(index: number, leaf: bigint, include = true): void {
    assertOrErr(index < ARITY ** DEPTH, `index must be < ${ARITY}^maxDepth`);
    assertOrErr(index >= this._count, "index must be >= tree count");
    assertOrErr(
      this.uncommittedLeaves.length === 0 ||
        index > this.uncommittedLeaves[this.uncommittedLeaves.length - 1].index,
      "insertions must be monotonic in index"
    );

    this.uncommittedLeaves.push({ index, leaf, include });
  }

  insertBatchUncommitted(
    startIndex: number,
    leaves: bigint[],
    includes: boolean[]
  ): void {
    assertOrErr(
      startIndex + leaves.length < ARITY ** DEPTH,
      `index must be < ${ARITY}^maxDepth`
    );
    assertOrErr(startIndex >= this._count, "index must be >= tree count");
    assertOrErr(
      leaves.length === includes.length,
      "leaves and includes must be the same length"
    );
    assertOrErr(
      this.uncommittedLeaves.length === 0 ||
        startIndex >
          this.uncommittedLeaves[this.uncommittedLeaves.length - 1].index,
      "insertions must be monotonic in index"
    );

    this.uncommittedLeaves.push(
      ...range(startIndex, startIndex + leaves.length).map((index) => ({
        index,
        leaf: leaves[index - startIndex],
        include: includes[index - startIndex],
      }))
    );
  }

  commitUpToIndex(commitIndex: number): void {
    const [newlyCommitted, uncommitted] = partition(
      this.uncommittedLeaves,
      ({ index }) => index >= this._count && index <= commitIndex
    );
    if (newlyCommitted.length === 0) {
      return;
    }

    for (const batch of consecutiveChunks(
      newlyCommitted,
      ({ index }) => index
    )) {
      this.insertBatch(
        batch[0].index,
        batch.map(({ leaf }) => leaf),
        batch.map(({ include }) => include)
      );
    }

    this.uncommittedLeaves = uncommitted;
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
      pathIndexReverse(index)
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

    for (const [currSiblings, pathIndex] of zip(siblings, pathIndices)) {
      assertOrErr(Array.isArray(currSiblings), "invalid siblings: not array");
      assertOrErr(
        typeof currSiblings[0] === "bigint",
        "invalid siblings: not bigint"
      );
      assertOrErr(
        typeof pathIndex === "number",
        "invalid pathIndex: not number"
      );
      assertOrErr(
        pathIndex >= 0 && pathIndex < ARITY,
        `invalid pathindex: not in range [0..${ARITY})`
      );

      const preimage = [
        ...currSiblings.slice(0, pathIndex),
        currentRoot,
        ...currSiblings.slice(pathIndex),
      ];
      currentRoot = poseidonBN(preimage);
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
      uncommittedLeaves: this.uncommittedLeaves,
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
    smt.uncommittedLeaves = dump.uncommittedLeaves;

    return smt;
  }

  // we can't prune a leaf if we need it to insert a new leaf or to prove membership of a leaf in the `leaves` map.
  // we need a leaf to generate a proof if:
  // 1. it's in the leaves map
  // 2. it's the sibling of a leaf in the leaves map
  // 3. it's a sibling of a leaf that we haven't inserted yet, which could be in the leaves map in the future
  //
  // to insert a new leaf, we need all of the leaves along the path to the rightmost leaf in the tree. In other words:
  // 4. we can't prune the rightmost leaf in the tree or any of its siblings (as we'd need them to recompute the root)
  //
  // Checking the following three conditions is equivalent to checking the above four conditions:
  // 1. it's in the leaves map
  // 2. it's the sibling of a leaf in the leaves map.
  // 3. it's in the rightmost depth-1 subtree
  //   - if the subtree is full (it has ARITY leaves) but none are in the leaves map, we can't prune the leaf because we need the path to the rightmost leaf in the tree.
  //     this covers condition 4 in the event that the subtree has ARITY leaves.
  //   - the subtree isn't full (it has < ARITY leaves) and none are in the leaves map, we can't prune the because we could insert another leaf, in which case we'd need this leaf because it would be a sibling
  //     this not only covers condition 3, but also condition 4 in the event the subtree has < ARITY leaves
  //   - whether the subtree is full or not, if this leaf or any of its siblings are in the leaves map, then checks 1 and/or 2 will apply.
  //
  private cannotPruneLeaf(index: number): boolean {
    const isInLeavesMap = this.leaves.has(index);

    // perform check 2 by checking the `leaves` map for a sibling of the current leaf, whose
    // index will be the current index with any of the two least significant bits flipped
    const isSiblingOfLeafInLeavesMap = range(1, ARITY).some((mask) =>
      this.leaves.has(index ^ mask)
    );

    const rightmostDepthOneSubtreeSize =
      this._count % ARITY === 0 ? ARITY : this._count % ARITY;
    const isInRightmostDepthOneSubtree =
      this._count - index <= rightmostDepthOneSubtreeSize;

    return (
      isInLeavesMap ||
      isSiblingOfLeafInLeavesMap ||
      isInRightmostDepthOneSubtree
    );
  }

  // returns number of leaves in the subtree that we can't prune
  private pruneHelper(root: TreeNode, depth: number, index = 0): number {
    if (depth === DEPTH && this.cannotPruneLeaf(index)) {
      return 1;
    }

    // if we get here, two cases:
    // 1. we're at a leaf. if we are, then we can safely prune it because we passed previous checks
    // 2. we're at an internal node. if we are, recurse and count the number of leaves in our child trees we can't prune
    const childCount = root.children.reduce(
      (count, child, pathIndex) =>
        count +
        (child
          ? this.pruneHelper(child, depth + 1, (index << 2) + pathIndex)
          : 0),
      0
    );

    // if there are no leaves in any of our child trees that we can't prune, then we can prune this node too
    if (childCount === 0) {
      root.children = [...NO_CHILDREN];
    }

    return childCount;
  }

  // returns [hashes, pathIndices]
  // NOTE: we assume every sibling will exist in the tree structure
  // because we only prune nodes that we will never need
  private getSiblings(
    root: TreeNode,
    pathMask: number,
    depth = 0
  ): [bigint[][], PathIndex[]] {
    if (depth === DEPTH) {
      return [[], []];
    }

    const pathIndex = pathMask & 0b11;
    const [siblings, pathIndices] = this.getSiblings(
      root.children[pathIndex]!,
      pathMask >> 2,
      depth + 1
    );

    return [
      [
        ...siblings,
        omitIndices(root.children, pathIndex).map((child) =>
          child ? child.hash : zeroHashAtDepth(depth)
        ),
      ],
      [...pathIndices, pathIndex],
    ];
  }

  private insertInner(
    root: TreeNode,
    leaves: bigint[],
    pathMask: number,
    depth = 0
  ): TreeNode {
    if (leaves.length === 0) return root;

    // we're at the leaf
    if (depth === DEPTH) {
      return { hash: leaves.shift()!, children: [...NO_CHILDREN] };
    }

    // we're not at the leaf
    let pathIndex = pathMask & 0b11;
    root.children[pathIndex] = this.insertInner(
      root.children[pathIndex] ?? emptyNode(depth),
      leaves,
      pathMask >> 2,
      depth + 1
    );

    while (leaves.length > 0 && ++pathIndex < ARITY) {
      root.children[pathIndex] = this.fillLeft(
        root.children[pathIndex] ?? emptyNode(depth),
        leaves,
        depth + 1
      );
    }

    root.hash = poseidonBN(
      root.children.map((child) =>
        child ? child.hash : zeroHashAtDepth(depth)
      )
    );
    return root;
  }

  // fill a subtree with leaves, starting from the left and stopping once we run out of leaves
  private fillLeft(root: TreeNode, leaves: bigint[], depth: number): TreeNode {
    if (leaves.length === 0) return root;

    if (depth === DEPTH) {
      return { hash: leaves.shift()!, children: [...NO_CHILDREN] };
    }

    let pathIndex = 0;
    do {
      root.children[pathIndex] = this.fillLeft(
        root.children[pathIndex] ?? emptyNode(depth),
        leaves,
        depth + 1
      );
    } while (leaves.length > 0 && ++pathIndex < ARITY);

    root.hash = poseidonBN(
      root.children.map((child) =>
        child ? child.hash : zeroHashAtDepth(depth)
      )
    );
    return root;
  }
}

// reverse order of the 2-bit chunks in binary representation of `x`
// https://stackoverflow.com/a/60227327, but with the first line removed
function pathIndexReverse(x: number): number {
  x = ((x >> 2) & 0x33333333) | ((x & 0x33333333) << 2);
  x = ((x >> 4) & 0x0f0f0f0f) | ((x & 0x0f0f0f0f) << 4);
  x = ((x >> 8) & 0x00ff00ff) | ((x & 0x00ff00ff) << 8);
  x = (x >>> 16) | (x << 16);

  return x >>> 0;
}
