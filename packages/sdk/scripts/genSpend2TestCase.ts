import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import { BinaryPoseidonTree } from "../src/primitives/binaryPoseidonTree";
import { FlaxSigner } from "../src/sdk/signer";
import { FlaxPrivKey } from "../src/crypto/privkey";
import {
  proveSpend2,
  verifySpend2Proof,
  MerkleProofInput,
  NoteInput,
  Spend2Inputs,
  spend2ProofToJson,
} from "../src/proof/spend2";
import { FlattenedFlaxAddress } from "../src/commonTypes";
import { poseidon } from "circomlibjs";

const ROOT_DIR = findWorkspaceRoot()!;
const SPEND2_FIXTURE_PATH = path.join(ROOT_DIR, "fixtures/spend2Proof.json");

const writeToFixture = process.argv[2] == "--writeFixture";

const sk = BigInt(
  "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
);

// Instantiate flax keypair and addr
const flaxPrivKey = new FlaxPrivKey(sk);
const vk = flaxPrivKey.vk;
const flaxSigner = new FlaxSigner(flaxPrivKey);
const flaxAddr = flaxSigner.address;
const spendPk = flaxSigner.privkey.spendPk();

const flaxAddrInput: FlattenedFlaxAddress = {
  h1X: flaxAddr.h1[0],
  h1Y: flaxAddr.h1[1],
  h2X: flaxAddr.h2[0],
  h2Y: flaxAddr.h2[1],
};

// Old note input to spend
const oldNote: NoteInput = {
  owner: flaxAddrInput,
  nonce: 1n,
  asset: 10n,
  value: 100n,
  id: 5n,
};
console.log("OLD NOTE: ", oldNote);

const ownerHash = flaxAddr.hash();
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
  const json = spend2ProofToJson(proof);
  console.log(json);

  if (writeToFixture) {
    fs.writeFileSync(SPEND2_FIXTURE_PATH, json, {
      encoding: "utf8",
      flag: "w",
    });
  }
  process.exit(0);
})();
