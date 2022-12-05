import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import { poseidon } from "circomlibjs";
import { LocalJoinSplitProver } from "../src/joinsplit";
import {
  BinaryPoseidonTree,
  NocturnePrivKey,
  NocturneSigner,
  JoinSplitInputs,
  MerkleProofInput,
  NoteInput,
  toJSON,
  hashNocturneAddress,
} from "@nocturne-xyz/sdk";

const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_js/joinsplit.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/joinsplit.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/vkey.json`;
const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH).toString());
const JOINSPLIT_FIXTURE_PATH = path.join(
  ROOT_DIR,
  "fixtures/joinsplitProof.json"
);

const writeToFixture = process.argv[2] == "--writeFixture";

const sk = BigInt(
  "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
);

// Instantiate nocturne keypair and addr
const nocturnePrivKey = new NocturnePrivKey(sk);
const vk = nocturnePrivKey.vk;
const nocturneSigner = new NocturneSigner(nocturnePrivKey);
const nocturneAddrA = nocturneSigner.address;
const nocturneAddrB = nocturneSigner.address;
const spendPk = nocturneSigner.privkey.spendPk();

// Two old notes: 100 + 50 = 150
const oldNoteA: NoteInput = {
  owner: nocturneAddrA,
  nonce: 1n,
  asset: 10n,
  value: 100n,
  id: 5n,
};
console.log("OLD NOTE A: ", oldNoteA);

const oldNoteAOwnerHash = hashNocturneAddress(nocturneAddrA);
const oldNoteACommitment = poseidon([
  oldNoteAOwnerHash,
  oldNoteA.nonce,
  oldNoteA.asset,
  oldNoteA.id,
  oldNoteA.value,
]);
console.log("OLD NOTE COMMITMENT A: ", oldNoteACommitment);

const oldNoteB: NoteInput = {
  owner: nocturneAddrB,
  nonce: 2n,
  asset: 10n,
  value: 50n,
  id: 5n,
};
console.log("OLD NOTE B: ", oldNoteB);

const oldNoteBOwnerHash = hashNocturneAddress(nocturneAddrB);
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

// New notes where 75 + 75 = 150
const newNoteA: NoteInput = {
  owner: nocturneAddrB,
  nonce: 3n,
  asset: 10n,
  value: 75n,
  id: 5n,
};
console.log("NEW NOTE A: ", newNoteA);

const newNoteB: NoteInput = {
  owner: nocturneAddrA,
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
const opSig = nocturneSigner.sign(operationDigest);
console.log(opSig);

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
console.log(joinsplitInputs);

(async () => {
  const prover = new LocalJoinSplitProver(WASM_PATH, ZKEY_PATH, VKEY);
  const proof = await prover.proveJoinSplit(joinsplitInputs);
  if (!(await prover.verifyJoinSplitProof(proof))) {
    throw new Error("Proof invalid!");
  }
  const json = toJSON(proof);
  console.log(json);

  if (writeToFixture) {
    fs.writeFileSync(JOINSPLIT_FIXTURE_PATH, json, {
      encoding: "utf8",
      flag: "w",
    });
  }
  process.exit(0);
})();
