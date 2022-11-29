//@ts-ignore
import * as snarkjs from "snarkjs";

import {
  JoinSplitInputs,
  JoinSplitProofWithPublicSignals,
  JoinSplitProver,
  normalizeJoinSplitInputs,
  normalizePublicSignals,
} from "@nocturne-xyz/sdk";

export class LocalJoinSplitProver implements JoinSplitProver {
  async proveJoinSplit(
    inputs: JoinSplitInputs,
    wasmPath: string,
    zkeyPath: string
  ): Promise<JoinSplitProofWithPublicSignals> {
    inputs = normalizeJoinSplitInputs(inputs);
    const {
      vk,
      operationDigest,
      oldNoteA,
      oldNoteB,
      spendPk,
      newNoteA,
      newNoteB,
      merkleProofA,
      merkleProofB,
      c,
      z,
    } = inputs;
    const signals = {
      userViewKey: vk,

      spendPubKey: spendPk,
      userViewKeyNonce: BigInt(1),

      operationDigest,

      c,
      z,

      oldNoteAOwnerH1X: oldNoteA.owner.h1X,
      oldNoteAOwnerH1Y: oldNoteA.owner.h1Y,
      oldNoteAOwnerH2X: oldNoteA.owner.h2X,
      oldNoteAOwnerH2Y: oldNoteA.owner.h2Y,
      oldNoteANonce: oldNoteA.nonce,
      oldNoteAEncodedAsset: oldNoteA.asset,
      oldNoteAEncodedId: oldNoteA.id,
      oldNoteAValue: oldNoteA.value,

      pathA: merkleProofA.path,
      siblingsA: merkleProofA.siblings,

      oldNoteBOwnerH1X: oldNoteB.owner.h1X,
      oldNoteBOwnerH1Y: oldNoteB.owner.h1Y,
      oldNoteBOwnerH2X: oldNoteB.owner.h2X,
      oldNoteBOwnerH2Y: oldNoteB.owner.h2Y,
      oldNoteBNonce: oldNoteB.nonce,
      oldNoteBEncodedAsset: oldNoteB.asset,
      oldNoteBEncodedId: oldNoteB.id,
      oldNoteBValue: oldNoteB.value,

      pathB: merkleProofB.path,
      siblingsB: merkleProofB.siblings,

      newNoteAOwnerH1X: newNoteA.owner.h1X,
      newNoteAOwnerH1Y: newNoteA.owner.h1Y,
      newNoteAOwnerH2X: newNoteA.owner.h2X,
      newNoteAOwnerH2Y: newNoteA.owner.h2Y,
      newNoteANonce: newNoteA.nonce,
      newNoteAEncodedAsset: newNoteA.asset,
      newNoteAEncodedId: newNoteA.id,
      newNoteAValue: newNoteA.value,

      newNoteBOwnerH1X: newNoteB.owner.h1X,
      newNoteBOwnerH1Y: newNoteB.owner.h1Y,
      newNoteBOwnerH2X: newNoteB.owner.h2X,
      newNoteBOwnerH2Y: newNoteB.owner.h2Y,
      newNoteBNonce: newNoteB.nonce,
      newNoteBEncodedAsset: newNoteB.asset,
      newNoteBEncodedId: newNoteB.id,
      newNoteBValue: newNoteB.value,
    };

    const proof = await snarkjs.groth16.fullProve(signals, wasmPath, zkeyPath);
    proof.publicSignals = normalizePublicSignals(proof.publicSignals);
    return proof;
  }

  async verifyJoinSplitProof(
    { proof, publicSignals }: JoinSplitProofWithPublicSignals,
    vkey: any
  ): Promise<boolean> {
    return await snarkjs.groth16.verify(vkey, publicSignals, proof);
  }
}
