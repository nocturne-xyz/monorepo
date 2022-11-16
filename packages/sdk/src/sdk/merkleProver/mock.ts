/* tslint:disable */
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { MerkleProver } from ".";

export class MockMerkleProver implements MerkleProver {
  constructor() {}

  getProof(index: number): MerkleProof {
    return {
      root: 1234,
      leaf: 1234,
      siblings: [1234],
      pathIndices: [1234],
    };
  }
}
