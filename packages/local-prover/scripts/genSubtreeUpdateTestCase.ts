import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import { Note, NocturneSigner, BinaryPoseidonTree, NocturnePrivKey, toJSON } from "@nocturne-xyz/sdk";
import { applyBatchUpdateToTree, localSubtreeUpdateProver, subtreeUpdateInputsFromBatch } from "../src/subtreeUpdate";

//@ts-ignore
import * as snarkjs from "snarkjs";

const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_js/subtreeupdate.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;

const FIXTURE_PATH = path.join(ROOT_DIR, "fixtures/subtreeupdateProof.json");

const writeToFixture = process.argv[2] == "--writeFixture";

// Instantiate flax keypair and addr
const sk = BigInt(
  "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
);
const nocturnePrivKey = new NocturnePrivKey(sk);
const nocturneSigner = new NocturneSigner(nocturnePrivKey);
const nocturneAddr = nocturneSigner.address;
const nocturneAddrInput = nocturneAddr.toStruct();
// start with empty tree
const tree = new BinaryPoseidonTree();

// dummy notes
const batch: (Note | bigint)[] = [...Array(BinaryPoseidonTree.BATCH_SIZE).keys()].map(_ => new Note({
  owner: nocturneAddrInput,
  nonce: 1n,
  asset: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  id: 5n,
  value: 100n,
}));

const noteCommitmentIndices = [1, 7, 9];
for (const i of noteCommitmentIndices) {
  batch[i] = (batch[i] as Note).toCommitment();
}

const merkleProof = applyBatchUpdateToTree(batch, tree);
const inputs = subtreeUpdateInputsFromBatch(batch, merkleProof);

async function prove() {
  const proof = await localSubtreeUpdateProver.prove(inputs, WASM_PATH, ZKEY_PATH);
  const json = toJSON(proof);
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
