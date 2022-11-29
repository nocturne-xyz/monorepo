
import { BinaryPoseidonTree, Note, bigInt256ToFieldElems, SubtreeUpdateProver, SubtreeUpdateInputSignals, SubtreeUpdateProofWithPublicSignals } from "@nocturne-xyz/sdk";
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { bigintToBuf, hexToBigint } from "bigint-conversion";
import { sha256 } from "js-sha256";

//@ts-ignore
import * as snarkjs from "snarkjs";

export const localSubtreeUpdateProver: SubtreeUpdateProver = {
	prove: (inputs: SubtreeUpdateInputSignals, wasmPath: string, zkeyPath: string) => {
		return snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath);
	},
	verify: ({ proof, publicSignals }: SubtreeUpdateProofWithPublicSignals, vkey: any) => {
		return snarkjs.groth16.verify(vkey, publicSignals, proof);
	},
};

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


// returns merkle proof for the 0th element inserted into the tree in this batch
export function applyBatchUpdateToTree(batch: (Note | bigint)[], tree: BinaryPoseidonTree): MerkleProof {
	for (const noteOrCommitment of batch) {
		if (typeof noteOrCommitment === "bigint") {
			const nc = noteOrCommitment;
			tree.insert(nc);
		} else {
			const note = noteOrCommitment;
			tree.insert(note.toCommitment());
		}
	}

	return tree.getProof(tree.count - batch.length);
}

/* generates inputs for subtree update circuit 
 * @param batch - array of notes or commitments
 * @param merkle - proof to the leftmost element of the batch. Assumes the batch is the last batch to have been inserted in the tree.
*/
export function subtreeUpdateInputsFromBatch(batch: (Note | bigint)[], merkleProof: MerkleProof): SubtreeUpdateInputSignals {
	if (batch.length !== BinaryPoseidonTree.BATCH_SIZE) {
		throw new Error(`\`batch.length\` ${BinaryPoseidonTree.BATCH_SIZE}, `);
	}

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

  const siblings = merkleProof.siblings.slice(BinaryPoseidonTree.S).map(arr => arr[0]);
	const idx = merkleProof.pathIndices.reduce((idx, bit) => (idx << 1n) | BigInt(bit), 0n);

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
