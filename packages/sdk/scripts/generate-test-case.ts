import { BinaryPoseidonTree } from "../src/primitives/BinaryPoseidonTree";
import { privToScalar } from "../src/crypto/babyjub-utils";
import { hexToBytes } from "../src/utils";
import { babyjub } from "circomlibjs";

const tree = new BinaryPoseidonTree();
tree.insert(5n);
console.log(tree.createProof(tree.count - 1));

const h1 = babyjub.Base8;

const vk = "0x28156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f";
const vkBuff = hexToBytes(vk);
const vkScalar = privToScalar(vkBuff);
const h2 = babyjub.mulPointEscalar(h1, vkScalar);

const sk = "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f";
const skBuff = hexToBytes(sk);
const skScalar = privToScalar(skBuff);
const h3 = babyjub.mulPointEscalar(h1, skScalar);

console.log("H1: ", h1);
console.log("H2", h2);
console.log("H3", h3);

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
