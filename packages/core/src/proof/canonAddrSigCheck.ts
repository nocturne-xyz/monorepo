import {
  CanonAddress,
  NocturneSignature,
  SpendPk,
  compressPoint,
  decomposeCompressedPoint,
} from "../crypto";
import { BaseProof } from "./types";
import * as ethers from "ethers";
import { BabyJubJubScalarField } from "@nocturne-xyz/crypto-utils";

export const CANON_ADDR_SIG_CHECK_PREFIX = BabyJubJubScalarField.reduce(
  BigInt(
    ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("nocturne-canonical-address-registry")
    )
  )
);

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
  nonce: bigint;
  sig: NocturneSignature;
  spendPubkey: SpendPk;
  vkNonce: bigint;
}

export interface CanonAddrSigCheckPublicSignals {
  compressedCanonAddrY: bigint;
  nonceAndSignBit: bigint;
}

export function canonAddrSigCheckPublicSignalsfromArray(
  publicSignals: bigint[]
): CanonAddrSigCheckPublicSignals {
  return {
    compressedCanonAddrY: publicSignals[0],
    nonceAndSignBit: publicSignals[1],
  };
}

export function canonAddrPublicSignalsToArray(
  publicSignals: CanonAddrSigCheckPublicSignals
): [bigint, bigint] {
  return [publicSignals.compressedCanonAddrY, publicSignals.nonceAndSignBit];
}

export function encodeCanonAddrSigCheckPis(
  canonAddr: CanonAddress,
  nonce: bigint
): CanonAddrSigCheckPublicSignals {
  if (nonce < 0 || nonce >= 1n << 64n) {
    throw new Error("Nonce must be a 64-bit unsigned integer");
  }

  const compressed = compressPoint(canonAddr);
  const [sign, y] = decomposeCompressedPoint(compressed);
  const signBit = sign ? 1n : 0n;
  return {
    compressedCanonAddrY: y,
    nonceAndSignBit: nonce | (signBit << 65n),
  };
}
