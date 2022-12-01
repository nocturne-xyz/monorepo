import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import {
  BinaryPoseidonTree,
  NocturneSigner,
  NocturnePrivKey,
  NoteInput,
  MerkleProofInput,
  Spend2Inputs,
  toJSON,
  hashNocturneAddress,
} from "@nocturne-xyz/sdk";
import { spend2Prover as prover } from "../src/spend2";
import { poseidon } from "circomlibjs";

const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/spend2/spend2_js/spend2.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/spend2/spend2_cpp/spend2.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/spend2/spend2_cpp/vkey.json`;
const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH).toString());
const SPEND2_FIXTURE_PATH = path.join(ROOT_DIR, "fixtures/spend2Proof.json");

const writeToFixture = process.argv[2] == "--writeFixture";

const sk = BigInt(
  "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
);

// Instantiate nocturne keypair and addr
const nocturnePrivKey = new NocturnePrivKey(sk);
const vk = nocturnePrivKey.vk;
const nocturneSigner = new NocturneSigner(nocturnePrivKey);
const nocturneAddr = nocturneSigner.address;
const spendPk = nocturneSigner.privkey.spendPk();

// Old note input to spend
const oldNote: NoteInput = {
  owner: nocturneAddr,
  nonce: 1n,
  asset: 10n,
  value: 100n,
  id: 5n,
};
console.log("OLD NOTE: ", oldNote);

const ownerHash = hashNocturneAddress(nocturneAddr);
const oldNoteCommitment = poseidon([
  ownerHash,
  oldNote.asset,
  oldNote.id,
  oldNote.value,
]);
console.log("OLD NOTE COMMITMENT: ", oldNoteCommitment);

// Generate valid merkle proof
const tree = new BinaryPoseidonTree();
tree.insert(oldNoteCommitment);
console.log("MERKLE ROOT: ", tree.root());

const merkleProof = tree.getProof(tree.count - 1);
const merkleProofInput: MerkleProofInput = {
  path: merkleProof.pathIndices.map((n) => BigInt(n)),
  siblings: merkleProof.siblings,
};
console.log(merkleProofInput);

// New note resulting from spend of 50 units
const newNote: NoteInput = {
  owner: nocturneAddr,
  nonce: 2n,
  asset: 10n,
  value: 50n,
  id: 5n,
};
console.log("NEW NOTE: ", newNote);

const newNoteCommitment = poseidon([
  ownerHash,
  newNote.asset,
  newNote.id,
  newNote.value,
]);
console.log("NEW NOTE COMMITMENT: ", newNoteCommitment);

// Sign operation hash
const operationDigest = BigInt(12345);
const opSig = nocturneSigner.sign(operationDigest);
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
  const proof = await prover.proveSpend2(spend2Inputs, WASM_PATH, ZKEY_PATH);
  if (!(await prover.verifySpend2Proof(proof, VKEY))) {
    throw new Error("Proof invalid!");
  }
  const json = toJSON(proof);
  console.log(json);

  if (writeToFixture) {
    fs.writeFileSync(SPEND2_FIXTURE_PATH, json, {
      encoding: "utf8",
      flag: "w",
    });
  }
  process.exit(0);
})();
