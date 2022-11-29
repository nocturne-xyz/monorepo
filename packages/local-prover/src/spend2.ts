//@ts-ignore
import * as snarkjs from "snarkjs";
import { normalizePublicSignals } from "@nocturne-xyz/sdk";
import {
  normalizeSpend2Inputs,
  Spend2Inputs,
  Spend2ProofWithPublicSignals,
  Spend2Prover,
} from "@nocturne-xyz/sdk";

export class LocalSpend2Prover implements Spend2Prover {
  async proveSpend2(
    inputs: Spend2Inputs,
    wasmPath: string,
    zkeyPath: string
  ): Promise<Spend2ProofWithPublicSignals> {
    inputs = normalizeSpend2Inputs(inputs);
    const {
      vk,
      operationDigest,
      oldNote,
      spendPk,
      newNote,
      merkleProof,
      c,
      z,
    } = inputs;
    const signals = {
      vk,

      spendPkX: spendPk[0],
      spendPkY: spendPk[1],
      spendPkNonce: BigInt(1),

      operationDigest,

      c,
      z,

      oldNoteOwnerH1X: oldNote.owner.h1X,
      oldNoteOwnerH1Y: oldNote.owner.h1Y,
      oldNoteOwnerH2X: oldNote.owner.h2X,
      oldNoteOwnerH2Y: oldNote.owner.h2Y,
      oldNoteNonce: oldNote.nonce,
      oldNoteAsset: oldNote.asset,
      oldNoteId: oldNote.id,
      oldNoteValue: oldNote.value,

      path: merkleProof.path,
      siblings: merkleProof.siblings,

      newNoteOwnerH1X: newNote.owner.h1X,
      newNoteOwnerH1Y: newNote.owner.h1Y,
      newNoteOwnerH2X: newNote.owner.h2X,
      newNoteOwnerH2Y: newNote.owner.h2Y,
      newNoteNonce: newNote.nonce,
      newNoteAsset: newNote.asset,
      newNoteId: newNote.id,
      newNoteValue: newNote.value,
    };

    const proof = await snarkjs.groth16.fullProve(signals, wasmPath, zkeyPath);
    proof.publicSignals = normalizePublicSignals(proof.publicSignals);
    return proof;
  }

  async verifySpend2Proof(
    { proof, publicSignals }: Spend2ProofWithPublicSignals,
    vkey: any
  ): Promise<boolean> {
    return await snarkjs.groth16.verify(vkey, publicSignals, proof);
  }
}
