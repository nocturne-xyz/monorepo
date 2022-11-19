/* eslint-disable */
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { MerkleProver } from ".";

export class MockMerkleProver extends MerkleProver {
  constructor() {
    super();
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
