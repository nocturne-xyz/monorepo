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
      spendPk,
      operationDigest,
      c,
      z,
      oldNoteA,
      oldNoteB,
      merkleProofA,
      merkleProofB,
      newNoteA,
      newNoteB,
    } = inputs;
    const signals = {
      userViewKey: vk,

      spendPubKey: spendPk,
      userViewKeyNonce: BigInt(1),

      encodedAsset: oldNoteA.asset,
      encodedId: oldNoteA.id,
      operationDigest,

      c,
      z,

      oldNoteAOwnerH1X: oldNoteA.owner.h1X,
      oldNoteAOwnerH1Y: oldNoteA.owner.h1Y,
      oldNoteAOwnerH2X: oldNoteA.owner.h2X,
      oldNoteAOwnerH2Y: oldNoteA.owner.h2Y,
      oldNoteANonce: oldNoteA.nonce,
      oldNoteAValue: oldNoteA.value,

      pathA: merkleProofA.path,
      siblingsA: merkleProofA.siblings,

      oldNoteBOwnerH1X: oldNoteB.owner.h1X,
      oldNoteBOwnerH1Y: oldNoteB.owner.h1Y,
      oldNoteBOwnerH2X: oldNoteB.owner.h2X,
      oldNoteBOwnerH2Y: oldNoteB.owner.h2Y,
      oldNoteBNonce: oldNoteB.nonce,
      oldNoteBValue: oldNoteB.value,

      pathB: merkleProofB.path,
      siblingsB: merkleProofB.siblings,

      newNoteAValue: newNoteA.value,

      receiverAddr: [newNoteB.owner.h2X, newNoteB.owner.h2Y],
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
