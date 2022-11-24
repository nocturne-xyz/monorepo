import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import { BinaryPoseidonTree } from "../src/primitives/binaryPoseidonTree";
import { FlaxSigner } from "../src/sdk/signer";
import { FlaxPrivKey } from "../src/crypto/privkey";
import {
  proveJoinSplit,
  verifyJoinSplitProof,
  MerkleProofInput,
  NoteInput,
  JoinSplitInputs,
} from "../src/proof/joinsplit";
import { poseidon } from "circomlibjs";

const ROOT_DIR = findWorkspaceRoot()!;
const JOINSPLIT_FIXTURE_PATH = path.join(
  ROOT_DIR,
  "fixtures/joinsplitProof.json"
);

const writeToFixture = process.argv[2] == "--writeFixture";

const sk = BigInt(
  "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
);

// Instantiate flax keypair and addr
const flaxPrivKey = new FlaxPrivKey(sk);
const vk = flaxPrivKey.vk;
const flaxSigner = new FlaxSigner(flaxPrivKey);
const flaxAddrA = flaxSigner.address;
const flaxAddrB = flaxSigner.address;
const spendPk = flaxSigner.privkey.spendPk();

const flaxAddrAInput = flaxAddrA.toStruct();
const flaxAddrBInput = flaxAddrB.toStruct();

// Two old notes: 100 + 50 = 150
const oldNoteA: NoteInput = {
  owner: flaxAddrAInput,
  nonce: 1n,
  asset: 10n,
  value: 100n,
  id: 5n,
};
console.log("OLD NOTE A: ", oldNoteA);

const oldNoteAOwnerHash = flaxAddrA.hash();
const oldNoteACommitment = poseidon([
  oldNoteAOwnerHash,
  oldNoteA.nonce,
  oldNoteA.asset,
  oldNoteA.id,
  oldNoteA.value,
]);
console.log("OLD NOTE COMMITMENT A: ", oldNoteACommitment);

const oldNoteB: NoteInput = {
  owner: flaxAddrBInput,
  nonce: 2n,
  asset: 10n,
  value: 50n,
  id: 5n,
};
console.log("OLD NOTE B: ", oldNoteB);

const oldNoteBOwnerHash = flaxAddrB.hash();
const oldNoteBCommitment = poseidon([
  oldNoteBOwnerHash,
  oldNoteB.nonce,
  oldNoteB.asset,
  oldNoteB.id,
  oldNoteB.value,
]);
console.log("OLD NOTE COMMITMENT B: ", oldNoteBCommitment);

// Generate valid merkle proofs
const tree = new BinaryPoseidonTree();
tree.insert(oldNoteACommitment);
tree.insert(oldNoteBCommitment);

const merkleProofA = tree.getProof(0);
const merkleProofB = tree.getProof(1);

console.log("MERKLE ROOT A: ", merkleProofA.root);
console.log("MERKLE ROOT B: ", merkleProofB.root);

const merkleProofAInput: MerkleProofInput = {
  path: merkleProofA.pathIndices.map((n) => BigInt(n)),
  siblings: merkleProofA.siblings,
};
const merkleProofBInput: MerkleProofInput = {
  path: merkleProofB.pathIndices.map((n) => BigInt(n)),
  siblings: merkleProofB.siblings,
};

// New notes where 75 + 75 = 150, swapping addrs
const newNoteA: NoteInput = {
  owner: flaxAddrBInput,
  nonce: 3n,
  asset: 10n,
  value: 75n,
  id: 5n,
};
console.log("NEW NOTE A: ", newNoteA);

const newNoteB: NoteInput = {
  owner: flaxAddrAInput,
  nonce: 4n,
  asset: 10n,
  value: 75n,
  id: 5n,
};
console.log("NEW NOTE B: ", newNoteB);

const newNoteACommitment = poseidon([
  oldNoteAOwnerHash,
  newNoteA.nonce,
  newNoteA.asset,
  newNoteA.id,
  newNoteA.value,
]);
console.log("NEW NOTE COMMITMENT A: ", newNoteACommitment);

const newNoteBCommitment = poseidon([
  oldNoteBOwnerHash,
  newNoteB.nonce,
  newNoteB.asset,
  newNoteB.id,
  newNoteB.value,
]);
console.log("NEW NOTE COMMITMENT B: ", newNoteBCommitment);

// Sign operation hash
const operationDigest = BigInt(12345);
const opSig = flaxSigner.sign(operationDigest);
console.log("opSig: ", opSig);

const joinsplitInputs: JoinSplitInputs = {
  vk,
  spendPk,
  operationDigest,
  c: opSig.c,
  z: opSig.z,
  oldNoteA,
  oldNoteB,
  newNoteA,
  newNoteB,
  merkleProofA: merkleProofAInput,
  merkleProofB: merkleProofBInput,
};
console.log("joinSplitInputs: ", joinsplitInputs);

(async () => {
  const proof = await proveJoinSplit(joinsplitInputs);
  if (!(await verifyJoinSplitProof(proof))) {
    throw new Error("Proof invalid!");
  }
  const json = JSON.stringify(proof);
  console.log(json);

  if (writeToFixture) {
    fs.writeFileSync(JOINSPLIT_FIXTURE_PATH, json, {
      encoding: "utf8",
      flag: "w",
    });
  }
  process.exit(0);
})();
