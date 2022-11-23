//@ts-nocheck

import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import { BinaryPoseidonTree } from "../src/primitives/binaryPoseidonTree";
import { FlaxSigner } from "../src/sdk/signer";
import { FlaxPrivKey } from "../src/crypto/privkey";
import { bigInt256ToBEBytes, splitBigInt256 } from "../src/sdk/utils";
import { Note } from "../src/sdk/note";
import { sha256 } from "js-sha256";

interface SubtreeUpdateInputSignals {
  encodedPathAndHash: bigint;
  accumulatorHash: bigint;

  siblings: bigint[];
  leaves: bigint[];
  bitmap: bigint[];
  ownerH1s: bigint[];
  ownerH2s: bigint[];
  nonces: bigint[];
  assets: bigint[];
  ids: bigint[];
  values: bigint[];
}

export function getSubtreeUpdateInputs(
  spendIndices: number[],
  spendNoteCommitments: bigint[],
  notes: Note[],
  tree: BinaryPoseidonTree,
): SubtreeUpdateInputSignals {
  const ownerH1s: bigint[] = [];
  const ownerH2s: bigint[] = [];
  const nonces: bigint[] = [];
  const assets: bigint[] = [];
  const ids: bigint[] = [];
  const values: bigint[] = [];
  const bitmap: bigint[] = [];

  const noteHashes: number[][] = [];
  const leaves: bigint[] = [];


  if (spendIndices.length !== spendNoteCommitments.length) {
    throw new Error("spendIndices.length !== spendNoteCommitments.length");
  }

  if (spendNoteCommitments.length + notes.length !== BinaryPoseidonTree.BATCH_SIZE) {
    throw new Error("Invalid number of notes / spends");
  }

  // note fields
  let spendIdxIdx = 0;
  let noteIdx = 0;
  for (let i = 0; i < BinaryPoseidonTree.BATCH_SIZE; i++) {

    if (spendIdxIdx < spendIndices.length && spendIndices[spendIdxIdx] === i) {
      ownerH1s.push(0n);
      ownerH2s.push(0n);
      nonces.push(0n);
      assets.push(0n);
      ids.push(0n);
      values.push(0n);
      bitmap.push(0n);
      noteHashes.push(bigInt256ToBEBytes(spendNoteCommitments[spendIdxIdx]));
      leaves.push(spendNoteCommitments[spendIdxIdx]);

      spendIdxIdx++;
    } else {
      const note = notes[noteIdx];
      ownerH1s.push(note.owner.h1X);
      ownerH2s.push(note.owner.h2X);
      nonces.push(note.nonce);
      assets.push(BigInt(note.asset));
      ids.push(note.id);
      values.push(note.value);
      bitmap.push(1n);
      noteHashes.push(note.sha256());
      leaves.push(note.toCommitment());

      noteIdx++;
    }
  }

  // accumulatorHash
  const accumulatorPreimage = noteHashes.reduce((acc, hash) => [...acc, ...hash]);
  const accumulatorHashU256 = BigInt(`0x${sha256.hex(accumulatorPreimage)}`);
  const [accumulatorHashHi, accumulatorHash] = splitBigInt256(accumulatorHashU256);

  // siblings
  const idx = tree.count;
  tree._insertEmptySubtree();
  const merkleProofToLeaf = tree.getProof(idx);
  const siblings = merkleProofToLeaf.siblings.slice(BinaryPoseidonTree.S).map(arr => arr[0]);
  tree._insertNonEmptySubtree(leaves);

  // encodedPathAndHash
  let encodedPathAndHash = BigInt(merkleProofToLeaf.pathIndices.slice(BinaryPoseidonTree.S).map((bit, i) => bit << i).reduce((a, b) => a | b));
  encodedPathAndHash += BigInt(accumulatorHashHi) * BigInt(1 << BinaryPoseidonTree.R);

  return {
    encodedPathAndHash,
    accumulatorHash,

    siblings,
    ownerH1s,
    ownerH2s,
    nonces,
    assets,
    ids,
    values,
    leaves,
    bitmap,
  };
}

const ROOT_DIR = findWorkspaceRoot()!;
const OUT_PATH = path.join(ROOT_DIR, "packages/circuits/scripts/subtreeupdate/input_subtreeupdate.json");
const SUBTREE_UPDATE_FIXTURE_PATH = path.join(ROOT_DIR, "fixtures/subtreeupdate.json");
const writeToFixture = process.argv[2] == "--writeFixture";

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
const notes = [...Array(BinaryPoseidonTree.BATCH_SIZE).keys()].map(_ => new Note({
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
console.log("inputs: ", inputs);

fs.writeFileSync(OUT_PATH, JSON.stringify(inputs));
