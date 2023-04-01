import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { assertOrErr, range } from "../utils";
import { poseidonBN } from "@nocturne-xyz/circuit-utils";
import { MerkleProver } from "./abstract";

interface Node {
  left?: Node;
  right?: Node;
  hash: bigint;
  needsPrune: boolean;
}

export interface SMTDump {
  root: Node;
  leaves: Map<number, bigint>;
  _count: number;
}

// (1 means right, 0 means left)
type PathIndex = 0 | 1;

const MAX_DEPTH: number = 32;

// TODO: turn these into constants
// ZERO_HASH[i] = root hash of empty merkle tree of depth MAX_DEPTH - i - 1
const ZERO_HASHES = [0n];
for (let i = 1; i < MAX_DEPTH; i++) {
  ZERO_HASHES.push(poseidonBN([ZERO_HASHES[i - 1], ZERO_HASHES[i - 1]]));
}
ZERO_HASHES.reverse();

export class SparseMerkleProver implements MerkleProver {
  private _count: number;
  private root: Node;
  private leaves: Map<number, bigint>;

  constructor(maxDepth: number) {
    assertOrErr(maxDepth > 0, "maxDepth must be > 0");
    this.root = {
      hash: ZERO_HASHES[0],
      needsPrune: false,
    };
    this.leaves = new Map();
    this._count = 0;
  }

  isLocal(): boolean {
    return true;
  }

  async count(): Promise<number> {
    return this._count;
  }

  async insert(index: number, leaf: bigint, include?: boolean): Promise<void> {
    assertOrErr(index < 1 << MAX_DEPTH, "index must be < 2^maxDepth");
    assertOrErr(index >= this._count, "index must be >= tree count");

    this.root = this.insertSparse(this.root, index, leaf, include ?? true, 0);

    if (include) {
      this.leaves.set(index, leaf);
    }
    this._count++;
  }

  async getProof(index: number): Promise<MerkleProof> {
    assertOrErr(
      this.leaves.has(index),
      "leaf is not in the tree or it has been pruned"
    );
    const [siblings, pathIndices] = this.getSiblings(this.root, index, 0);

    return {
      root: this.root.hash,
      leaf: this.leaves.get(index)!,
      siblings,
      pathIndices,
    };
  }

  prune(): void {
    this.pruneHelper(this.root, 0);
  }

  dump(): SMTDump {
    return {
      root: this.root,
      leaves: this.leaves,
      _count: this._count,
    };
  }

  load(dump: SMTDump): void {
    this.root = dump.root;
    this.leaves = dump.leaves;
    this._count = dump._count;
  }

  // returns the number of non-zero leaves pruned from a subtree
  private pruneHelper(root: Node, depth: number): number {
    if (depth === MAX_DEPTH - 1 || !root.needsPrune) {
      return 0;
    }

    let leftCount = root.left ? this.pruneHelper(root.left, depth + 1) : 0;
    let rightCount = root.right ? this.pruneHelper(root.right, depth + 1) : 0;

    if (leftCount + rightCount === 0) {
      root.needsPrune = false;
      root.left = undefined;
      root.right = undefined;
    }

    return leftCount + rightCount;
  }

  // returns [hashes, pathIndices]
  private getSiblings(
    root: Node,
    index: number,
    depth: number
  ): [bigint[], PathIndex[]] {
    if (depth === MAX_DEPTH - 1) {
      return [[], []];
    }

    if (index & 1) {
      // path goes to the right => get the left sibling
      // `root.right` is guaranteed to exist because we checked `this.leaves.has(index)`
      const [siblings, pathIndices] = this.getSiblings(
        root.right!,
        index >> 1,
        depth + 1
      );
      return [
        [root.left?.hash ?? ZERO_HASHES[depth], ...siblings],
        [...pathIndices, 1],
      ];
    } else {
      // path goes to the left => get the right sibling
      // `root.left` is guaranteed to exist because we checked `this.leaves.has(index)`
      const [siblings, pathIndices] = this.getSiblings(
        root.left!,
        index >> 1,
        depth + 1
      );
      return [
        [...siblings, root.right?.hash ?? ZERO_HASHES[depth]],
        [...pathIndices, 0],
      ];
    }
  }

  private insertSparse(
    root: Node,
    index: number,
    leaf: bigint,
    include: boolean,
    depth: number
  ): Node {
    // we're at the leaf
    if (depth === MAX_DEPTH - 1) {
      return { hash: leaf, needsPrune: !include };
    }

    // we're not at the leaf
    if (index & 1) {
      // right
      root.left = this.insertSparse(
        root.left ?? { hash: ZERO_HASHES[depth + 1], needsPrune: !include },
        index >> 1,
        leaf,
        include,
        depth + 1
      );
    } else {
      // left
      root.right = this.insertSparse(
        root.right ?? { hash: ZERO_HASHES[depth + 1], needsPrune: !include },
        index >> 1,
        leaf,
        include,
        depth + 1
      );
    }

    root.needsPrune = !include || root.needsPrune;
    root.hash = poseidonBN([
      root.right?.hash ?? ZERO_HASHES[depth],
      root.left?.hash ?? ZERO_HASHES[depth],
    ]);

    return root;
  }
}
