//@ts-ignore
import * as snarkjs from "snarkjs";

import {
  JoinSplitInputs,
  JoinSplitProofWithPublicSignals,
  JoinSplitProver,
} from "@nocturne-xyz/sdk";

export class LocalJoinSplitProver implements JoinSplitProver {
  wasmPath: string;
  zkeyPath: string;
  vkey: any;

  constructor(wasmPath: string, zkeyPath: string, vkey: any) {
    this.wasmPath = wasmPath;
    this.zkeyPath = zkeyPath;
    this.vkey = vkey;
  }

  async proveJoinSplit(
    inputs: JoinSplitInputs
  ): Promise<JoinSplitProofWithPublicSignals> {
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

      encodedAddr: oldNoteA.encodedAddr,
      encodedId: oldNoteA.encodedId,
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

    const proof = await snarkjs.groth16.fullProve(
      signals,
      this.wasmPath,
      this.zkeyPath
    );
    return proof;
  }

  async verifyJoinSplitProof({
    proof,
    publicSignals,
  }: JoinSplitProofWithPublicSignals): Promise<boolean> {
    return await snarkjs.groth16.verify(this.vkey, publicSignals, proof);
  }
}
