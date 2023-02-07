import {
  SubtreeUpdateProver,
  SubtreeUpdateInputs,
  SubtreeUpdateProofWithPublicSignals,
} from "@nocturne-xyz/sdk";

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
