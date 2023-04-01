import { MerkleProof } from "@zk-kit/incremental-merkle-tree";

export abstract class MerkleProver {
  abstract getProof(index: number): Promise<MerkleProof>;

  abstract count(): Promise<number>;

  abstract insert(
    index: number,
    leaf: bigint,
    include?: boolean
  ): Promise<void>;

  isLocal(): boolean {
    return "localTree" in this;
  }
}
