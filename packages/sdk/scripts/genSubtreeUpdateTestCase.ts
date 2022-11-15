import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import { BinaryPoseidonTree } from "../src/primitives/binaryPoseidonTree";
import { FlaxSigner } from "../src/sdk/signer";
import { FlaxPrivKey } from "../src/crypto/privkey";
import { splitBigInt256 } from "../src/sdk/utils";
import { sha256 } from "js-sha256";
import { Note } from "../src/sdk";

const ROOT_DIR = findWorkspaceRoot()!;
const OUT_PATH = path.join(ROOT_DIR, "packages/circuits/scripts/subtreeupdate/input_subtreeupdate.json");

const sk = BigInt(
  "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
);

// Instantiate flax keypair and addr
const flaxPrivKey = new FlaxPrivKey(sk);
const flaxSigner = new FlaxSigner(flaxPrivKey);
const flaxAddr = flaxSigner.address;

const flaxAddrInput = flaxAddr.toStruct();

// start with empty tree

const tree = new BinaryPoseidonTree();
tree._insertEmptySubtree();
const merkleProofToLeaf = tree.getProof(0);

// dummy notes to insert into the tree
const notes: Note[] = [...Array(BinaryPoseidonTree.SUBTREE_SIZE).keys()].map(_ => new Note({
  owner: flaxAddrInput,
  nonce: 1n,
  asset: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  id: 5n,
  value: 100n,
}));

// accumulatorHash
const noteHashes = notes.map(note => note.sha256());
const accumulatorPreimage = noteHashes.reduce((acc, hash) => [...acc, ...hash]);
const accumulatorHashU256 = BigInt(`0x${sha256.hex(accumulatorPreimage)}`);

const [accumulatorHashHi, accumulatorHash] = splitBigInt256(accumulatorHashU256);

// siblings
const siblings = merkleProofToLeaf.siblings.slice(BinaryPoseidonTree.S).map(arr => arr[0]);

// encodedPathAndHash
let encodedPathAndHash = BigInt(merkleProofToLeaf.pathIndices.slice(BinaryPoseidonTree.S).map((bit, i) => bit << i).reduce((a, b) => a | b));
encodedPathAndHash += BigInt(accumulatorHashHi) * BigInt(1 << BinaryPoseidonTree.R);

// note fields
const ownerH1s: bigint[] = [];
const ownerH2s: bigint[] = [];
const nonces: bigint[] = [];
const assets: bigint[] = [];
const ids: bigint[] = [];
const values: bigint[] = [];
notes.forEach(note => {
	ownerH1s.push(note.owner.h1X);
	ownerH2s.push(note.owner.h2X);
	nonces.push(note.nonce);
	assets.push(BigInt(note.asset));
	ids.push(note.id);
	values.push(note.value);
});

const leaves = notes.map(note => note.toCommitmentRistretto());
tree._insertNonEmptySubtree(leaves);

// sanity check
const proof = tree.getProof(0);
const newSiblings = proof.siblings.slice(BinaryPoseidonTree.S).map(arr => arr[0]);
const siblingsAreSame = siblings.every((sibling, i) => sibling === newSiblings[i]);
if (!siblingsAreSame) {
	console.log("old siblings:", siblings);
	console.log("new siblings:", newSiblings);
	throw new Error("siblings changed!");
}

// write inputs to JSON file
const inputs = {
	encodedPathAndHash,
	accumulatorHash,

	siblings,
	ownerH1s,
	ownerH2s,
	nonces,
	assets,
	ids,
	values,
};

// console.log("inputs: ", inputs);

fs.writeFileSync(OUT_PATH, JSON.stringify(inputs));
