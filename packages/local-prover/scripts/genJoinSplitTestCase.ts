import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import { poseidonBN } from "@nocturne-xyz/circuit-utils";
import { WasmJoinSplitProver } from "../src/joinsplit";
import {
  BinaryPoseidonTree,
  NocturneSigner,
  JoinSplitInputs,
  MerkleProofInput,
  EncodedNote,
  StealthAddressTrait,
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
const nocturneSigner = new NocturneSigner(sk);
const vk = nocturneSigner.vk;
const stealthAddrA = nocturneSigner.getRandomStealthAddress();
const stealthAddrB = nocturneSigner.getRandomStealthAddress();
const spendPk = nocturneSigner.spendPk;

// Two old notes: 100 + 50 = 150
const oldNoteA: EncodedNote = {
  owner: stealthAddrA,
  nonce: 1n,
  encodedAssetAddr: 10n,
  encodedAssetId: 5n,
  value: 100n,
};
console.log("OLD NOTE A: ", oldNoteA);

const oldNoteAOwnerHash = StealthAddressTrait.hash(stealthAddrA);
const oldNoteACommitment = poseidonBN([
  oldNoteAOwnerHash,
  oldNoteA.nonce,
  oldNoteA.encodedAssetAddr,
  oldNoteA.encodedAssetId,
  oldNoteA.value,
]);
console.log("OLD NOTE COMMITMENT A: ", oldNoteACommitment);

const oldNoteB: EncodedNote = {
  owner: stealthAddrB,
  nonce: 2n,
  encodedAssetAddr: 10n,
  encodedAssetId: 5n,
  value: 50n,
};
console.log("OLD NOTE B: ", oldNoteB);

const oldNoteBOwnerHash = StealthAddressTrait.hash(stealthAddrB);
const oldNoteBCommitment = poseidonBN([
  oldNoteBOwnerHash,
  oldNoteB.nonce,
  oldNoteB.encodedAssetAddr,
  oldNoteB.encodedAssetId,
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
const newNoteA: EncodedNote = {
  owner: stealthAddrB,
  nonce: 3n,
  encodedAssetAddr: 10n,
  encodedAssetId: 5n,
  value: 75n,
};
console.log("NEW NOTE A: ", newNoteA);

const newNoteB: EncodedNote = {
  owner: stealthAddrA,
  nonce: 4n,
  encodedAssetAddr: 10n,
  encodedAssetId: 5n,
  value: 75n,
};
console.log("NEW NOTE B: ", newNoteB);

const newNoteACommitment = poseidonBN([
  oldNoteAOwnerHash,
  newNoteA.nonce,
  newNoteA.encodedAssetAddr,
  newNoteA.encodedAssetId,
  newNoteA.value,
]);
console.log("NEW NOTE COMMITMENT A: ", newNoteACommitment);

const newNoteBCommitment = poseidonBN([
  oldNoteBOwnerHash,
  newNoteB.nonce,
  newNoteB.encodedAssetAddr,
  newNoteB.encodedAssetId,
  newNoteB.value,
]);
console.log("NEW NOTE COMMITMENT B: ", newNoteBCommitment);

// Sign operation hash
const operationDigest = BigInt(12345);
const opSig = nocturneSigner.sign(operationDigest);
console.log(opSig);

const joinsplitInputs: JoinSplitInputs = {
  vk,
  spendPk: [spendPk.x, spendPk.y],
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
  const prover = new WasmJoinSplitProver(WASM_PATH, ZKEY_PATH, VKEY);
  const proof = await prover.proveJoinSplit(joinsplitInputs);
  if (!(await prover.verifyJoinSplitProof(proof))) {
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
