// import { BinaryPoseidonTree } from "../src/primitives/BinaryPoseidonTree";
import buildFlaxCrypto from "../src/crypto";

// const tree = new BinaryPoseidonTree();
// tree.insert(5n);
// console.log(tree.createProof(tree.count - 1));

// const babyJub = buildBabyJub();
// const h1 = babyJub.mulPointEscalar(babyJub.Base8);

var main = async () => {
    var flaxCrypto = await buildFlaxCrypto()
    console.log(flaxCrypto.genKey())
}

main()


/*
export interface FlaxAddressInput {
  h1X: bigint;
  h1Y: bigint;
  h2X: bigint;
  h2Y: bigint;
  h3X: bigint;
  h3Y: bigint;
}

export interface NoteInput {
  owner: FlaxAddressInput;
  nonce: bigint;
  type: bigint;
  value: bigint;
  id: bigint;
}

export interface MerkleProofInput {
  path: bigint[];
  siblings: bigint[];
}

export interface Spend2Inputs {
  vk: bigint;
  operationDigest: bigint;
  c: bigint;
  z: bigint;
  oldNote: NoteInput;
  newNote: NoteInput;
  merkleProof: MerkleProofInput;
}

*/
