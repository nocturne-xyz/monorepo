//@ts-ignore
import * as snarkjs from "snarkjs";
import {
  CanonAddrSigCheckInputs,
  CanonAddrSigCheckProofWithPublicSignals,
  CanonAddrSigCheckProver,
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
    const { canonAddr, sig, spendPubkey, vkNonce } = inputs;

    const signals = {
      canonAddrX: canonAddr.x,
      canonAddrY: canonAddr.y,
      sig: [sig.c, sig.z],
      spendPubkey: [spendPubkey.x, spendPubkey.y],
      vkNonce,
    };

    const proof = await snarkjs.groth16.fullProve(
      signals,
      this.wasmPath,
      this.zkeyPath
    );

    // ensure publicSignals are BigInts
    proof.publicSignals = proof.publicSignals.map((val: any) =>
      BigInt(val as string)
    );
    return proof;
  }

  async verifyCanonAddrSigCheckProof({
    proof,
    publicSignals,
  }: CanonAddrSigCheckProofWithPublicSignals): Promise<boolean> {
    return await snarkjs.groth16.verify(this.vkey, publicSignals, proof);
  }
}
