import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import { Note, FlaxSigner } from "../src/sdk";
import { BinaryPoseidonTree } from "../src/primitives";
import { FlaxPrivKey } from "../src/crypto";
import { subtreeUpdateInputsFromBatch } from "../src/proof";


const ROOT_DIR = findWorkspaceRoot()!;
const OUT_PATH = path.join(ROOT_DIR, "packages/circuits/scripts/subtreeupdate/input_subtreeupdate.json");

const sk = BigInt(
  "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
);

// Instantiate flax keypair and addr
const flaxPrivKey = new FlaxPrivKey(sk);
const flaxSigner = new FlaxSigner(flaxPrivKey);
const flaxAddr = flaxSigner.address;
const flaxAddrInput = flaxAddr.toStruct();

// start with empty tree
const tree = new BinaryPoseidonTree();

// dummy notes
const batch: (Note | bigint)[] = [...Array(BinaryPoseidonTree.BATCH_SIZE).keys()].map(_ => new Note({
  owner: flaxAddrInput,
  nonce: 1n,
  asset: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  id: 5n,
  value: 100n,
}));

const noteCommitmentIndices = [1, 7, 9];
for (const i of noteCommitmentIndices) {
  batch[i] = (batch[i] as Note).toCommitment();
}

const inputs = subtreeUpdateInputsFromBatch(batch, tree);
console.log("inputs: ", inputs);

fs.writeFileSync(OUT_PATH, JSON.stringify(inputs));
