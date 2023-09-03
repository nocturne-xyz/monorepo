import { CanonAddress, NocturneSignature, SpendPk } from "../crypto";
import { BaseProof } from "./types";
import * as ethers from "ethers";
import { BabyJubJubScalarField } from "@nocturne-xyz/crypto-utils";

export const CANON_ADDR_SIG_CHECK_MSG = BabyJubJubScalarField.reduce(
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
  sig: NocturneSignature;
  spendPubkey: SpendPk;
  vkNonce: bigint;
}

export interface CanonAddrSigCheckPublicSignals {
  canonAddrX: bigint;
  canonAddrY: bigint;
}

export function canonAddrSigCheckPublicSignalsfromArray(
  publicSignals: bigint[]
): CanonAddrSigCheckPublicSignals {
  return {
    canonAddrX: publicSignals[0],
    canonAddrY: publicSignals[1],
  };
}

export function canonAddrPublicSignalsToArray(
  publicSignals: CanonAddrSigCheckPublicSignals
): [bigint, bigint] {
  return [publicSignals.canonAddrX, publicSignals.canonAddrY];
}
