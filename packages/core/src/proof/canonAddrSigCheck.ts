import {
  CanonAddress,
  NocturneSignature,
  SpendPk,
  compressPoint,
  decomposeCompressedPoint,
} from "../crypto";
import { BaseProof } from "./types";

export interface CanonAddrSigCheckProver {
  proveCanonAddrSigCheck(
    inputs: CanonAddrSigCheckInputs
  ): Promise<CanonAddrSigCheckProofWithPublicSignals>;

  verifyCanonAddrSigCheckProof({
    proof,
    publicSignals,
  }: CanonAddrSigCheckProofWithPublicSignals): Promise<boolean>;
}

export interface CanonAddrSigCheckProofWithPublicSignals {
  proof: BaseProof;
  publicSignals: [bigint, bigint];
}

export interface CanonAddrSigCheckInputs {
  canonAddr: CanonAddress;
  msg: bigint;
  sig: NocturneSignature;
  spendPubkey: SpendPk;
  vkNonce: bigint;
}

export interface CanonAddrSigCheckPublicSignals {
  compressedCanonAddrY: bigint;
  msgAndSignBit: bigint;
}

export function canonAddrSigCheckPublicSignalsfromArray(
  publicSignals: bigint[]
): CanonAddrSigCheckPublicSignals {
  return {
    compressedCanonAddrY: publicSignals[0],
    msgAndSignBit: publicSignals[1],
  };
}

export function canonAddrPublicSignalsToArray(
  publicSignals: CanonAddrSigCheckPublicSignals
): [bigint, bigint] {
  return [publicSignals.compressedCanonAddrY, publicSignals.msgAndSignBit];
}

export function encodeCanonAddrSigCheckPis(
  canonAddr: CanonAddress,
  msg: bigint
): CanonAddrSigCheckPublicSignals {
  if (msg < 0 || msg >= 1n << 252n) {
    throw new Error("msg must be a 252-bit unsigned integer");
  }

  const compressed = compressPoint(canonAddr);
  const [sign, y] = decomposeCompressedPoint(compressed);
  const signBit = sign ? 1n : 0n;
  return {
    compressedCanonAddrY: y,
    msgAndSignBit: msg | (signBit << 252n),
  };
}
