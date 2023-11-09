import {
  SubtreeUpdateProver,
  SubtreeUpdateInputs,
  SubtreeUpdateProofWithPublicSignals,
} from "@nocturne-xyz/core";

import { groth16 } from "snarkjs";

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
    const { proof, publicSignals } = await groth16.fullProve(
      { ...inputs },
      this.wasmPath,
      this.zkeyPath
    );

    return {
      proof,
      publicSignals: publicSignals.map((val: any) => BigInt(val)) as [
        bigint,
        bigint,
        bigint,
        bigint
      ],
    };
  }

  async verifySubtreeUpdate({
    proof,
    publicSignals,
  }: SubtreeUpdateProofWithPublicSignals): Promise<boolean> {
    return await groth16.verify(
      this.vkey,
      publicSignals.map((signal) => signal.toString()),
      { ...proof, curve: "bn128" }
    );
  }
}
