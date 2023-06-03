import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import { poseidonBN } from "@nocturne-xyz/circuit-utils";
import { WasmJoinSplitProver } from "../src/joinsplit";
import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";
import {
  NocturneSigner,
  JoinSplitInputs,
  MerkleProofInput,
  EncodedNote,
  StealthAddressTrait,
  randomFr,
  encodeEncodedAssetAddrWithSignBitsPI,
  TreeConstants,
} from "@nocturne-xyz/sdk";

const { ZERO_VALUE, ARITY, DEPTH } = TreeConstants;

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
const stealthAddrA = nocturneSigner.canonicalStealthAddress();
const stealthAddrB = nocturneSigner.canonicalStealthAddress();
const spendPk = nocturneSigner.spendPk;

// Two old notes: 100 + 50 = 150
const oldNoteA: EncodedNote = {
  owner: stealthAddrA,
  nonce: 1n,
  encodedAssetAddr: 10n,
  encodedAssetId: 5n,
  value: 100n,
};
console.log("old note A: ", oldNoteA);

const oldNoteAOwnerHash = StealthAddressTrait.hash(stealthAddrA);
const oldNoteACommitment = poseidonBN([
  oldNoteAOwnerHash,
  oldNoteA.nonce,
  oldNoteA.encodedAssetAddr,
  oldNoteA.encodedAssetId,
  oldNoteA.value,
]);
console.log("old note commitment A: ", oldNoteACommitment);

const oldNoteB: EncodedNote = {
  owner: stealthAddrB,
  nonce: 2n,
  encodedAssetAddr: 10n,
  encodedAssetId: 5n,
  value: 50n,
};
console.log("old note B: ", oldNoteB);

const oldNoteBOwnerHash = StealthAddressTrait.hash(stealthAddrB);
const oldNoteBCommitment = poseidonBN([
  oldNoteBOwnerHash,
  oldNoteB.nonce,
  oldNoteB.encodedAssetAddr,
  oldNoteB.encodedAssetId,
  oldNoteB.value,
]);
console.log("old note commitment B: ", oldNoteBCommitment);

// Generate valid merkle proofs
const tree = new IncrementalMerkleTree(poseidonBN, DEPTH, ZERO_VALUE, ARITY);
tree.insert(oldNoteACommitment);
tree.insert(oldNoteBCommitment);

const merkleProofA = tree.createProof(0);
const merkleProofB = tree.createProof(1);

// console.log("merkleProofA", merkleProofA);
// console.log("merkleProofB", merkleProofB);

console.log("merkle root A: ", merkleProofA.root);
console.log("merkle root B: ", merkleProofB.root);

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
  owner: stealthAddrA,
  nonce: 3n,
  encodedAssetAddr: 10n,
  encodedAssetId: 5n,
  value: 75n,
};
console.log("new note A: ", newNoteA);

const newNoteB: EncodedNote = {
  owner: stealthAddrB,
  nonce: 4n,
  encodedAssetAddr: 10n,
  encodedAssetId: 5n,
  value: 75n,
};
console.log("new note B: ", newNoteB);

const newNoteACommitment = poseidonBN([
  oldNoteAOwnerHash,
  newNoteA.nonce,
  newNoteA.encodedAssetAddr,
  newNoteA.encodedAssetId,
  newNoteA.value,
]);
console.log("new note commitment A: ", newNoteACommitment);

const newNoteBCommitment = poseidonBN([
  oldNoteBOwnerHash,
  newNoteB.nonce,
  newNoteB.encodedAssetAddr,
  newNoteB.encodedAssetId,
  newNoteB.value,
]);
console.log("new note commitment B: ", newNoteBCommitment);

// Sign operation hash
const operationDigest = BigInt(12345);
const opSig = nocturneSigner.sign(operationDigest);
console.log(opSig);

const encRandomness = randomFr();
const encSenderCanonAddr = nocturneSigner.encryptCanonAddrToReceiver(
  nocturneSigner.canonicalAddress(),
  encRandomness
);

console.log("encSenderCanonAddr", encSenderCanonAddr);

const joinsplitInputs: JoinSplitInputs = {
  vk,
  vkNonce: nocturneSigner.vkNonce,
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
  encRandomness,
  encodedAssetAddrWithSignBits: encodeEncodedAssetAddrWithSignBitsPI(
    oldNoteA.encodedAssetAddr,
    encSenderCanonAddr
  ),
};
console.log(joinsplitInputs);

(async () => {
  const prover = new WasmJoinSplitProver(WASM_PATH, ZKEY_PATH, VKEY);
  const startTime = Date.now();
  const proof = await prover.proveJoinSplit(joinsplitInputs);
  console.log("Proof generated in: ", Date.now() - startTime, "ms");

  if (!(await prover.verifyJoinSplitProof(proof))) {
    throw new Error("proof invalid!");
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
