import findWorkspaceRoot from "find-yarn-workspace-root";
import * as JSON from "bigint-json-serialization";
import * as path from "path";
import * as fs from "fs";

import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";
import {
  AssetType,
  NocturneSigner,
  Note,
  NoteTrait,
  range,
  subtreeUpdateInputsFromBatch,
  TreeConstants,
} from "@nocturne-xyz/core";
import { WasmSubtreeUpdateProver } from "../src/subtreeUpdate";
import { poseidonBN } from "@nocturne-xyz/crypto-utils";

const ROOT_DIR = findWorkspaceRoot()!;
const FIXTURE_PATH = path.join(ROOT_DIR, "fixtures/subtreeupdateProof.json");

const sk = Uint8Array.from(range(32));

const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_js/subtreeupdate.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/vkey.json`;
const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH, "utf8"));

console.log("argv", process.argv);
const writeToFixture = process.argv[2] == "--writeFixture";

// Instantiate nocturne keypair and addr
const nocturneSigner = new NocturneSigner(sk);
const stealthAddr = nocturneSigner.generateRandomStealthAddress();

// start with empty tree
const tree = new IncrementalMerkleTree(
  poseidonBN,
  TreeConstants.DEPTH,
  TreeConstants.ZERO_VALUE,
  TreeConstants.ARITY
);

// dummy notes
const batch: (Note | bigint)[] = [
  ...Array(TreeConstants.BATCH_SIZE).keys(),
].map((_) => {
  return {
    owner: stealthAddr,
    nonce: 1n,
    asset: {
      assetType: AssetType.ERC20,
      assetAddr: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      id: 5n,
    },
    value: 100n,
  };
});

const noteCommitmentIndices = [1, 7, 9];
for (const i of noteCommitmentIndices) {
  batch[i] = NoteTrait.toCommitment(batch[i] as Note);
}

for (const noteOrCommitment of batch) {
  if (typeof noteOrCommitment === "bigint") {
    tree.insert(noteOrCommitment);
  } else {
    tree.insert(NoteTrait.toCommitment(noteOrCommitment));
  }
}
const merkleProof = tree.createProof(0);

const inputs = subtreeUpdateInputsFromBatch(batch, merkleProof);
console.log(inputs);

async function prove() {
  const prover = new WasmSubtreeUpdateProver(WASM_PATH, ZKEY_PATH, VKEY);
  const startTime = Date.now();
  const proof = await prover.proveSubtreeUpdate(inputs);
  console.log("Proof generated in: ", Date.now() - startTime, "ms");
  const json = JSON.stringify(proof);
  console.log(json);

  if (writeToFixture) {
    fs.writeFileSync(FIXTURE_PATH, json, {
      encoding: "utf8",
      flag: "w",
    });
  }
  process.exit(0);
}

prove();
