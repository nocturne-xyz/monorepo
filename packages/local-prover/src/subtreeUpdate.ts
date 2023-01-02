import {
  BinaryPoseidonTree,
  Note,
  bigInt256ToFieldElems,
  SubtreeUpdateProver,
  SubtreeUpdateInputs,
  SubtreeUpdateProofWithPublicSignals,
  NoteTrait,
  bigintToBEPadded,
  encodeAsset,
} from "@nocturne-xyz/sdk";
import { MerkleProof } from "@zk-kit/incremental-merkle-tree";
import { sha256 } from "js-sha256";

//@ts-ignore
import * as snarkjs from "snarkjs";

export class LocalSubtreeUpdateProver implements SubtreeUpdateProver {
  wasmPath: string;
  zkeyPath: string;
  vkey: any;

  constructor(wasmPath: string, zkeyPath: string, vkey: any) {
    this.wasmPath = wasmPath;
    this.zkeyPath = zkeyPath;
    this.vkey = vkey;
  }

  async proveSubtreeUpdate(
    inputs: SubtreeUpdateInputs
  ): Promise<SubtreeUpdateProofWithPublicSignals> {
    return await snarkjs.groth16.fullProve(
      inputs,
      this.wasmPath,
      this.zkeyPath
    );
  }

  async verifySubtreeUpdate({
    proof,
    publicSignals,
  }: SubtreeUpdateProofWithPublicSignals): Promise<boolean> {
    return await snarkjs.groth16.verify(this.vkey, publicSignals, proof);
  }
}

export function encodePathAndHash(
  idx: bigint,
  accumulatorHashHi: bigint
): bigint {
  idx = BigInt.asUintN(256, idx);
  accumulatorHashHi = BigInt.asUintN(256, accumulatorHashHi);

  if (idx % BigInt(BinaryPoseidonTree.BATCH_SIZE) !== 0n) {
    throw new Error("idx must be a multiple of BATCH_SIZE");
  }

  let encodedPathAndHash = idx >> BigInt(BinaryPoseidonTree.S);
  encodedPathAndHash |= accumulatorHashHi << BigInt(BinaryPoseidonTree.R);
  return encodedPathAndHash;
}

/* generates inputs for subtree update circuit
 * @param batch - array of notes or commitments
 * @param merkle - proof to the leftmost element of the batch. Assumes the batch is the last batch to have been inserted in the tree.
 */
export function subtreeUpdateInputsFromBatch(
  batch: (Note | bigint)[],
  merkleProof: MerkleProof
): SubtreeUpdateInputs {
  if (batch.length !== BinaryPoseidonTree.BATCH_SIZE) {
    throw new Error(`\`batch.length\` ${BinaryPoseidonTree.BATCH_SIZE}, `);
  }

  const ownerH1s: bigint[] = [];
  const ownerH2s: bigint[] = [];
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

      ownerH1s.push(0n);
      ownerH2s.push(0n);
      nonces.push(0n);
      encodedAssetAddrs.push(0n);
      encodedAssetIds.push(0n);
      values.push(0n);
    } else {
      const note = noteOrCommitment;
      accumulatorPreimage.push(...NoteTrait.sha256(note));
      leaves.push(NoteTrait.toCommitment(note));
      bitmap.push(1n);
      ownerH1s.push(note.owner.h1X);
      ownerH2s.push(note.owner.h2X);
      const { encodedAssetAddr, encodedAssetId } = encodeAsset(note.asset);
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

  const siblings = merkleProof.siblings
    .slice(BinaryPoseidonTree.S)
    .map((arr) => arr[0]);
  const idx = merkleProof.pathIndices.reduce(
    (idx, bit) => (idx << 1n) | BigInt(bit),
    0n
  );

  // encodedPathAndHash
  const encodedPathAndHash = encodePathAndHash(BigInt(idx), accumulatorHashHi);

  return {
    encodedPathAndHash,
    accumulatorHash,

    siblings,
    ownerH1s,
    ownerH2s,
    nonces,
    encodedAssetAddrs,
    encodedAssetIds,
    values,
    leaves,
    bitmap,
  };
}
