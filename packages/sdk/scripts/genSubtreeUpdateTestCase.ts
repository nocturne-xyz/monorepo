import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import { BinaryPoseidonTree } from "../src/primitives/binaryPoseidonTree";
import { FlaxSigner } from "../src/sdk/signer";
import { FlaxPrivKey } from "../src/crypto/privkey";
import { Note } from "../src/sdk";
import { getSubtreeUpdateInputs } from "../src/proof/subtreeUpdateInputs";

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
const notes = [...Array(BinaryPoseidonTree.SUBTREE_SIZE).keys()].map(_ => new Note({
  owner: flaxAddrInput,
  nonce: 1n,
  asset: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  id: 5n,
  value: 100n,
}));

const spendIndices = [1, 7, 9];
const spendNoteCommitments = spendIndices.map(i => notes[i].toCommitment());
const nonSpendNotes = notes.filter((_, i) => !spendIndices.includes(i));

const inputs = getSubtreeUpdateInputs(spendIndices, spendNoteCommitments, nonSpendNotes, tree);
// console.log("inputs: ", inputs);

fs.writeFileSync(OUT_PATH, JSON.stringify(inputs));
