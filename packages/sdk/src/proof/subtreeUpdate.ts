
import { BinaryPoseidonTree } from "../primitives";
import { Note, bigInt256ToFieldElems } from "../sdk";
import { bigintToBuf, hexToBigint } from "bigint-conversion";
import { sha256 } from "js-sha256";

export interface SubtreeUpdateInputSignals {
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

export function encodePathAndHash(idx: bigint, accumulatorHashHi: bigint): bigint {
  idx = BigInt.asUintN(256, idx);
  accumulatorHashHi = BigInt.asUintN(256, accumulatorHashHi);

  if (idx % BigInt(BinaryPoseidonTree.BATCH_SIZE) !== 0n) {
    throw new Error("idx must be a multiple of BATCH_SIZE");
  }

  let encodedPathAndHash = idx >> BigInt(BinaryPoseidonTree.S);
  encodedPathAndHash |= accumulatorHashHi << BigInt(BinaryPoseidonTree.R);
  return encodedPathAndHash;
}

// given a batch and a tree, generate the input signals for the subtree update circuit
// if `modifyTree` is `true`, then the batch will also be applying to `tree`.
export function subtreeUpdateInputsFromBatch(batch: (Note | bigint)[], tree: BinaryPoseidonTree, modifyTree = false): SubtreeUpdateInputSignals {
	const ownerH1s: bigint[] = [];
	const ownerH2s: bigint[] = [];
	const nonces: bigint[] = [];
	const assets: bigint[] = [];
	const ids: bigint[] = [];
	const values: bigint[] = [];

	const accumulatorPreimage = [];
	const leaves = [];
	const bitmap: bigint[] = [];

	// note fields
	for (const noteOrCommitment of batch) {
		if (typeof noteOrCommitment === "bigint") {
			const nc = noteOrCommitment;
			accumulatorPreimage.push(...[...new Uint8Array(bigintToBuf(nc, true))]);
			leaves.push(nc);
			bitmap.push(0n);

			ownerH1s.push(0n);
			ownerH2s.push(0n);
			nonces.push(0n);
			assets.push(0n);
			ids.push(0n);
			values.push(0n);
		} else {
			const note = noteOrCommitment;
			accumulatorPreimage.push(...note.sha256());
			leaves.push(note.toCommitment());
			bitmap.push(1n);

      ownerH1s.push(note.owner.h1X);
      ownerH2s.push(note.owner.h2X);
      nonces.push(note.nonce);
      assets.push(BigInt(note.asset));
      ids.push(note.id);
      values.push(note.value);
		}
	}

  // accumulatorHash
  const accumulatorHashU256 = hexToBigint(sha256.hex(accumulatorPreimage));
  const [accumulatorHashHi, accumulatorHash] = bigInt256ToFieldElems(accumulatorHashU256);

  // siblings
  const idx = tree.count;
  for (let i = 0; i < BinaryPoseidonTree.BATCH_SIZE; i++) {
    tree.insert(0n);
  }
  const merkleProofToLeaf = tree.getProof(idx);
  const siblings = merkleProofToLeaf.siblings.slice(BinaryPoseidonTree.S).map(arr => arr[0]);

	if (!modifyTree) {
		for (let i = 0; i < leaves.length; i++) {
			tree.pop();
		}
	} else {
		for (let i = 0; i < leaves.length; i++) {
			tree.update(idx + i, leaves[i]);
		}
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
