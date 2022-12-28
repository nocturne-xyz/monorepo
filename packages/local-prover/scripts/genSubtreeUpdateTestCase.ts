import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";

//@ts-ignore
import * as snarkjs from "snarkjs";
import { sha256 } from "js-sha256";
import {
  BaseProof,
  bigInt256ToFieldElems,
  bigintToBuf,
  BinaryPoseidonTree,
  NocturnePrivKey,
  NocturneSigner,
  Note,
  NoteTrait,
} from "@nocturne-xyz/sdk";

const ROOT_DIR = findWorkspaceRoot()!;
const FIXTURE_PATH = path.join(ROOT_DIR, "fixtures/subtreeupdateProof.json");

const sk = BigInt(
  "0x38156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69f"
);
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_js/subtreeupdate.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;

const writeToFixture = process.argv[2] == "--writeFixture";

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

export interface SubtreeUpdateProofWithPublicSignals {
  proof: BaseProof;
  publicSignals: [
    bigint, // oldRoot
    bigint, // newRoot
    bigint, // encodedPathAndHash
    bigint // accumulatorHash
  ];
}

function encodePathAndHash(idx: bigint, accumulatorHashHi: bigint): bigint {
  idx = BigInt.asUintN(256, idx);
  accumulatorHashHi = BigInt.asUintN(256, accumulatorHashHi);

  if (idx % BigInt(BinaryPoseidonTree.BATCH_SIZE) !== 0n) {
    throw new Error("idx must be a multiple of BATCH_SIZE");
  }

  let encodedPathAndHash = idx >> BigInt(BinaryPoseidonTree.S);
  encodedPathAndHash |= accumulatorHashHi << BigInt(BinaryPoseidonTree.R);
  return encodedPathAndHash;
}

export function getSubtreeUpdateInputs(
  noteCommitmentIndices: number[],
  spendNoteCommitments: bigint[],
  notes: Note[],
  tree: BinaryPoseidonTree
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

  if (noteCommitmentIndices.length !== spendNoteCommitments.length) {
    throw new Error(
      "noteCommitmentIndices.length !== spendNoteCommitments.length"
    );
  }

  if (
    spendNoteCommitments.length + notes.length !==
    BinaryPoseidonTree.BATCH_SIZE
  ) {
    throw new Error("Invalid number of notes / spends");
  }

  // note fields
  let noteCommitmentIdx = 0;
  let noteIdx = 0;
  for (let i = 0; i < BinaryPoseidonTree.BATCH_SIZE; i++) {
    if (
      noteCommitmentIdx < noteCommitmentIndices.length &&
      noteCommitmentIndices[noteCommitmentIdx] === i
    ) {
      ownerH1s.push(0n);
      ownerH2s.push(0n);
      nonces.push(0n);
      assets.push(0n);
      ids.push(0n);
      values.push(0n);
      bitmap.push(0n);
      noteHashes.push([
        ...bigintToBuf(spendNoteCommitments[noteCommitmentIdx]),
      ]);
      leaves.push(spendNoteCommitments[noteCommitmentIdx]);

      noteCommitmentIdx++;
    } else {
      const note = notes[noteIdx];
      ownerH1s.push(note.owner.h1X);
      ownerH2s.push(note.owner.h2X);
      nonces.push(note.nonce);
      assets.push(BigInt(note.asset));
      ids.push(note.id);
      values.push(note.value);
      bitmap.push(1n);
      noteHashes.push(NoteTrait.sha256(note));
      leaves.push(NoteTrait.toCommitment(note));

      noteIdx++;
    }
  }

  // accumulatorHash
  const accumulatorPreimage = noteHashes.reduce((acc, hash) => [
    ...acc,
    ...hash,
  ]);
  const accumulatorHashU256 = BigInt("0x" + sha256.hex(accumulatorPreimage));
  const [accumulatorHashHi, accumulatorHash] =
    bigInt256ToFieldElems(accumulatorHashU256);

  // siblings
  const idx = tree.count;
  for (let i = 0; i < BinaryPoseidonTree.BATCH_SIZE; i++) {
    tree.insert(0n);
  }
  const merkleProofToLeaf = tree.getProof(idx);
  const siblings = merkleProofToLeaf.siblings
    .slice(BinaryPoseidonTree.S)
    .map((arr) => arr[0]);
  for (let i = 0; i < leaves.length; i++) {
    tree.update(idx + i, leaves[i]);
  }

  // encodedPathAndHash
  const encodedPathAndHash = encodePathAndHash(BigInt(idx), accumulatorHashHi);

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

// Instantiate nocturne keypair and addr
const nocturnePrivKey = new NocturnePrivKey(sk);
const nocturneSigner = new NocturneSigner(nocturnePrivKey);
const nocturneAddr = nocturneSigner.address;

// start with empty tree
const tree = new BinaryPoseidonTree();

// dummy notes
const notes: Note[] = [...Array(BinaryPoseidonTree.BATCH_SIZE).keys()].map(
  (_) => {
    return {
      owner: nocturneAddr,
      nonce: 1n,
      asset: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      id: 5n,
      value: 100n,
    };
  }
);

const noteCommitmentIndices = [1, 7, 9];
const spendNoteCommitments = noteCommitmentIndices.map((i) =>
  NoteTrait.toCommitment(notes[i])
);

const fullyRevealedNotes = notes.filter(
  (_, i) => !noteCommitmentIndices.includes(i)
);

const inputs = getSubtreeUpdateInputs(
  noteCommitmentIndices,
  spendNoteCommitments,
  fullyRevealedNotes,
  tree
);
console.log(inputs);

async function prove() {
  const proof = await snarkjs.groth16.fullProve(inputs, WASM_PATH, ZKEY_PATH);
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
