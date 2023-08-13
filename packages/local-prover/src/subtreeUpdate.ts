import {
  SubtreeUpdateProver,
  SubtreeUpdateInputs,
  SubtreeUpdateProofWithPublicSignals,
} from "@nocturne-xyz/core";

//@ts-ignore
import * as snarkjs from "snarkjs";

export class WasmSubtreeUpdateProver implements SubtreeUpdateProver {
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
    const proof = await snarkjs.groth16.fullProve(
      inputs,
      this.wasmPath,
      this.zkeyPath
    );

    proof.publicSignals = proof.publicSignals.map((val: any) => BigInt(val));
    return proof;
  }

  async verifySubtreeUpdate({
    proof,
    publicSignals,
  }: SubtreeUpdateProofWithPublicSignals): Promise<boolean> {
    return await snarkjs.groth16.verify(this.vkey, publicSignals, proof);
  }
}
