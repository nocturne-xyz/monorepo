import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import { BinaryPoseidonTree } from "../src/primitives/binaryPoseidonTree";
import { FlaxPrivKey, FlaxSigner } from "../src/crypto/crypto";
import {
  proveSpend2,
  verifySpend2Proof,
  MerkleProofInput,
  NoteInput,
  FlaxAddressInput,
  Spend2Inputs,
} from "../src/proof/spend2";
import { babyjub, poseidon } from "circomlibjs";

const ROOT_DIR = findWorkspaceRoot()!;
const SPEND2_FIXTURE_PATH = path.join(ROOT_DIR, "fixtures/spend2Proof.json");

const sk = BigInt(
  "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
);

const spendPk = babyjub.mulPointEscalar(babyjub.Base8, sk);

// Instantiate flax keypair and addr
const flaxPrivKey = new FlaxPrivKey(sk);
const vk = flaxPrivKey.vk;
const flaxSigner = new FlaxSigner(flaxPrivKey);
const flaxAddr = flaxSigner.address;

const flaxAddrInput: FlaxAddressInput = {
  h1X: flaxAddr.H1[0],
  h1Y: flaxAddr.H1[1],
  h2X: flaxAddr.H2[0],
  h2Y: flaxAddr.H2[1],
};

// Old note input to spend
const oldNote: NoteInput = {
  owner: flaxAddrInput,
  nonce: 1n,
  type: 10n,
  value: 100n,
  id: 5n,
};
console.log("OLD NOTE: ", oldNote);

const ownerHash = poseidon([flaxAddr.H1[0], flaxAddr.H2[0]]);
const oldNoteCommitment = poseidon([
  ownerHash,
  oldNote.type,
  oldNote.id,
  oldNote.value,
]);
console.log("OLD NOTE COMMITMENT: ", oldNoteCommitment);

// Generate valid merkle proof
const tree = new BinaryPoseidonTree();
tree.insert(oldNoteCommitment);
console.log("MERKLE ROOT: ", tree.root());

const merkleProof = tree.createProof(tree.count - 1);
const merkleProofInput: MerkleProofInput = {
  path: merkleProof.pathIndices.map((n) => BigInt(n)),
  siblings: merkleProof.siblings,
};
console.log(merkleProofInput);

// New note resulting from spend of 50 units
const newNote: NoteInput = {
  owner: flaxAddrInput,
  nonce: 2n,
  type: 10n,
  value: 50n,
  id: 5n,
};
console.log("NEW NOTE: ", newNote);

const newNoteCommitment = poseidon([
  ownerHash,
  newNote.type,
  newNote.id,
  newNote.value,
]);
console.log("NEW NOTE COMMITMENT: ", newNoteCommitment);

// Sign operation hash
const operationDigest = BigInt(12345);
const opSig = flaxSigner.sign(operationDigest);
console.log(opSig);

const spend2Inputs: Spend2Inputs = {
  vk,
  spendPk,
  operationDigest,
  c: opSig.c,
  z: opSig.z,
  oldNote,
  newNote,
  merkleProof: merkleProofInput,
};
console.log(spend2Inputs);

(async () => {
  const proof = await proveSpend2(spend2Inputs);
  if (!(await verifySpend2Proof(proof))) {
    throw new Error("Proof invalid!");
  }
  const json = JSON.stringify(proof);
  console.log(json);

  fs.writeFileSync(SPEND2_FIXTURE_PATH, json, {
    encoding: "utf8",
    flag: "w",
  });
  process.exit(0);
})();
