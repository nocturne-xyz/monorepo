import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { BinaryPoseidonTree } from "../primitives";
import { MerkleProver } from "./abstract";
import { assertOrErr } from "../utils";

export class InMemoryMerkleProver extends MerkleProver {
  readonly localTree: BinaryPoseidonTree;

  constructor() {
    super();

    this.localTree = new BinaryPoseidonTree();
  }

  root(): bigint {
    return this.localTree.root();
  }

  async count(): Promise<number> {
    return this.localTree.count;
  }

  async getProof(index: number): Promise<MerkleProof> {
    return this.localTree.getProof(index);
  }

  async insert(index: number, leaf: bigint): Promise<void> {
    assertOrErr(index >= this.localTree.count, "index must be >= tree count");
    while (this.localTree.count < index) {
      this.localTree.insert(0n);
    }

    this.localTree.insert(leaf);
  }
}
