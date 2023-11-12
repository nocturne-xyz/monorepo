import { groth16 } from "snarkjs";
import {
  CanonAddrSigCheckInputs,
  CanonAddrSigCheckProofWithPublicSignals,
  CanonAddrSigCheckProver,
  encodeCanonAddrSigCheckPis,
  VerifyingKey,
} from "@nocturne-xyz/core";

export class WasmCanonAddrSigCheckProver implements CanonAddrSigCheckProver {
  wasmPath: string;
  zkeyPath: string;
  vkey: VerifyingKey;

  constructor(wasmPath: string, zkeyPath: string, vkey: VerifyingKey) {
    this.wasmPath = wasmPath;
    this.zkeyPath = zkeyPath;
    this.vkey = vkey;
  }

  async proveCanonAddrSigCheck(
    inputs: CanonAddrSigCheckInputs
  ): Promise<CanonAddrSigCheckProofWithPublicSignals> {
    const { canonAddr, msg, sig, spendPubkey, vkNonce } = inputs;

    const { compressedCanonAddrY, msgAndSignBit } = encodeCanonAddrSigCheckPis(
      canonAddr,
      msg
    );

    const signals = {
      compressedCanonAddrY,
      msgAndSignBit,
      sig: [sig.c, sig.z],
      spendPubkey: [spendPubkey.x, spendPubkey.y],
      vkNonce,
    };

    const { proof, publicSignals } = await groth16.fullProve(
      signals,
      this.wasmPath,
      this.zkeyPath
    );

    return {
      proof,
      publicSignals: publicSignals.map((val) => BigInt(val)) as [
        bigint,
        bigint
      ],
    };
  }

  async verifyCanonAddrSigCheckProof({
    proof,
    publicSignals,
  }: CanonAddrSigCheckProofWithPublicSignals): Promise<boolean> {
    return await groth16.verify(
      this.vkey,
      publicSignals.map((signal) => signal.toString()),
      { ...proof, curve: "bn128" }
    );
  }
}
