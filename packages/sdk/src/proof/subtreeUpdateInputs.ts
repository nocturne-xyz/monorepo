import { BinaryPoseidonTree } from "../primitives/binaryPoseidonTree";
import { splitBigInt256, bigInt256ToBEBytes } from "../sdk/utils";
import { sha256 } from "js-sha256";
import { Note } from "../sdk";

export interface SubtreeUpdateInputs {
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
): SubtreeUpdateInputs {
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

  if (spendNoteCommitments.length + notes.length !== BinaryPoseidonTree.SUBTREE_SIZE) {
    throw new Error("Invalid number of notes / spends");
  }

  // note fields
  let spendIdxIdx = 0;
  let noteIdx = 0;
  for (let i = 0; i < BinaryPoseidonTree.SUBTREE_SIZE; i++) {

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