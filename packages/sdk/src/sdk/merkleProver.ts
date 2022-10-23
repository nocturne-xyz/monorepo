import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { BinaryPoseidonTree } from "../primitives/binaryPoseidonTree";

export interface MerkleProver {
  getProof(index: number): MerkleProof;
}

export class LocalMerkleProver
  extends BinaryPoseidonTree
  implements MerkleProver
{
  constructor() {
    super();
  }

  getProof(index: number): MerkleProof {
    return this.createProof(index);
  }
}
