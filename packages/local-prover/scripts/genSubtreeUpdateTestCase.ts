import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";

import {
  AssetType,
  BinaryPoseidonTree,
  NocturnePrivKey,
  NocturneSigner,
  Note,
  NoteTrait,
  subtreeUpdateInputsFromBatch,
} from "@nocturne-xyz/sdk";
import { LocalSubtreeUpdateProver } from "../src/subtreeUpdate";

const ROOT_DIR = findWorkspaceRoot()!;
const FIXTURE_PATH = path.join(ROOT_DIR, "fixtures/subtreeupdateProof.json");

const sk = BigInt(
  "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
);
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_js/subtreeupdate.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/vkey.json`;
const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH, "utf8"));

const writeToFixture = process.argv[2] == "--writeFixture";

// Instantiate nocturne keypair and addr
const nocturnePrivKey = new NocturnePrivKey(sk);
const nocturneSigner = new NocturneSigner(nocturnePrivKey);
const stealthAddr = nocturneSigner.address;

// start with empty tree
const tree = new BinaryPoseidonTree();

// dummy notes
const batch: (Note | bigint)[] = [
  ...Array(BinaryPoseidonTree.BATCH_SIZE).keys(),
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
const merkleProof = tree.getProof(0);

const inputs = subtreeUpdateInputsFromBatch(batch, merkleProof);
console.log(inputs);

async function prove() {
  const prover = new LocalSubtreeUpdateProver(WASM_PATH, ZKEY_PATH, VKEY);
  const proof = await prover.proveSubtreeUpdate(inputs);
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
