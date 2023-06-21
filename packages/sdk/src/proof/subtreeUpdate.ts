import { BaseProof } from "./types";
import { Note, NoteTrait, AssetTrait, TreeConstants } from "../primitives";
import { bigintToBEPadded, bigInt256ToFieldElems } from "../utils";
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { sha256 } from "js-sha256";
import { merklePathToIndex } from "../utils/misc";

export interface SubtreeUpdateProofWithPublicSignals {
  proof: BaseProof;
  publicSignals: [
    bigint, // oldRoot
    bigint, // newRoot
    bigint, // encodedPathAndHash
    bigint // accumulatorHash
  ];
}

export interface SubtreeUpdateInputs {
  encodedPathAndHash: bigint;
  accumulatorHash: bigint;

  siblings: bigint[][];
  leaves: bigint[];
  bitmap: bigint[];
  ownerH1Xs: bigint[];
  ownerH1Ys: bigint[];
  ownerH2Xs: bigint[];
  ownerH2Ys: bigint[];
  nonces: bigint[];
  encodedAssetAddrs: bigint[];
  encodedAssetIds: bigint[];
  values: bigint[];
}

export interface SubtreeUpdateProver {
  proveSubtreeUpdate(
    inputs: SubtreeUpdateInputs
  ): Promise<SubtreeUpdateProofWithPublicSignals>;

  verifySubtreeUpdate({
    proof,
    publicSignals,
  }: SubtreeUpdateProofWithPublicSignals): Promise<boolean>;
}

/* generates inputs for subtree update circuit
 * @param batch - array of notes or commitments
 * @param merkle - proof to the leftmost element of the batch. Assumes the batch is the last batch to have been inserted in the tree.
 */
export function subtreeUpdateInputsFromBatch(
  batch: (Note | bigint)[],
  merkleProof: MerkleProof
): SubtreeUpdateInputs {
  if (batch.length !== TreeConstants.BATCH_SIZE) {
    throw new Error(`\`batch.length\` != ${TreeConstants.BATCH_SIZE}`);
  }

  const ownerH1Xs: bigint[] = [];
  const ownerH1Ys: bigint[] = [];
  const ownerH2Xs: bigint[] = [];
  const ownerH2Ys: bigint[] = [];
  const nonces: bigint[] = [];
  const encodedAssetAddrs: bigint[] = [];
  const encodedAssetIds: bigint[] = [];
  const values: bigint[] = [];

  const accumulatorPreimage = [];
  const leaves = [];
  const bitmap: bigint[] = [];

  // note fields
  for (const noteOrCommitment of batch) {
    if (typeof noteOrCommitment === "bigint") {
      const nc = noteOrCommitment;
      accumulatorPreimage.push(...bigintToBEPadded(nc, 32));
      leaves.push(nc);
      bitmap.push(0n);

      ownerH1Xs.push(0n);
      ownerH1Ys.push(0n);
      ownerH2Xs.push(0n);
      ownerH2Ys.push(0n);
      nonces.push(0n);
      encodedAssetAddrs.push(0n);
      encodedAssetIds.push(0n);
      values.push(0n);
    } else {
      const note = noteOrCommitment;
      accumulatorPreimage.push(...NoteTrait.sha256(note));
      leaves.push(NoteTrait.toCommitment(note));
      bitmap.push(1n);
      ownerH1Xs.push(note.owner.h1X);
      ownerH1Ys.push(note.owner.h1Y);
      ownerH2Xs.push(note.owner.h2X);
      ownerH2Ys.push(note.owner.h2Y);
      const { encodedAssetAddr, encodedAssetId } = AssetTrait.encode(
        note.asset
      );
      nonces.push(note.nonce);
      encodedAssetAddrs.push(encodedAssetAddr);
      encodedAssetIds.push(encodedAssetId);
      values.push(note.value);
    }
  }

  // accumulatorHash
  const accumulatorHashU256 = BigInt("0x" + sha256.hex(accumulatorPreimage));
  const [accumulatorHashHi, accumulatorHash] =
    bigInt256ToFieldElems(accumulatorHashU256);

  const siblings = merkleProof.siblings.slice(TreeConstants.SUBTREE_DEPTH);
  const idx = merklePathToIndex(
    merkleProof.pathIndices.map(BigInt),
    "LEAF_TO_ROOT"
  );

  // encodedPathAndHash
  const encodedPathAndHash = encodePathAndHash(idx, accumulatorHashHi);

  return {
    encodedPathAndHash,
    accumulatorHash,

    siblings,
    ownerH1Xs,
    ownerH1Ys,
    ownerH2Xs,
    ownerH2Ys,
    nonces,
    encodedAssetAddrs,
    encodedAssetIds,
    values,
    leaves,
    bitmap,
  };
}

export function encodePathAndHash(
  idx: bigint,
  accumulatorHashHi: bigint
): bigint {
  idx = BigInt.asUintN(256, idx);
  accumulatorHashHi = BigInt.asUintN(256, accumulatorHashHi);

  if (idx % BigInt(TreeConstants.BATCH_SIZE) !== 0n) {
    throw new Error("idx must be a multiple of BATCH_SIZE");
  }

  // we shift by 2 * depth because tree is quaternary
  let encodedPathAndHash = idx >> BigInt(2 * TreeConstants.SUBTREE_DEPTH);
  encodedPathAndHash |=
    accumulatorHashHi << BigInt(2 * TreeConstants.DEPTH_TO_SUBTREE);
  return encodedPathAndHash;
}
