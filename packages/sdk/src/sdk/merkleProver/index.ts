import { MerkleProof } from "@zk-kit/incremental-merkle-tree";

export interface MerkleProver {
  getProof(index: number): MerkleProof;
}

export * from "./local";
