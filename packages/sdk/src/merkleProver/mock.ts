/* eslint-disable */
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { MerkleProver } from "./abstract";

export class MockMerkleProver extends MerkleProver {
  constructor() {
    super();
  }

  async count(): Promise<number> {
    return 0;
  }

  async insert(index: number, leaf: bigint): Promise<void> {
    return;
  }

  async getProof(index: number): Promise<MerkleProof> {
    return {
      root: 1234,
      leaf: 1234,
      siblings: [1234],
      pathIndices: [1234],
    };
  }
}
