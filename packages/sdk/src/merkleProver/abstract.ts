import { MerkleProof } from "@zk-kit/incremental-merkle-tree";

export abstract class MerkleProver {
  abstract getProof(index: number): Promise<MerkleProof>;

  isLocal(): boolean {
    return "localTree" in this;
  }
}
