import { BinaryPoseidonTree } from "../src/primitives/BinaryPoseidonTree";
import { privToAddr, FlaxPrivKey } from "../src/crypto/crypto";

const tree = new BinaryPoseidonTree();
tree.insert(5n);
console.log(tree.createProof(tree.count - 1));

const privKey: FlaxPrivKey = {
  vk: BigInt(
    "0x28156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
  ),
  sk: BigInt(
    "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
  ),
};
const flaxAddr = privToAddr(privKey);

console.log("H1: ", flaxAddr.H1);
console.log("H2", flaxAddr.H2);
console.log("H3", flaxAddr.H3);

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
