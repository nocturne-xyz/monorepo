/* eslint-disable */

export const SNARK_SCALAR_FIELD: bigint =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export interface BaseProof {
  pi_a: any;
  pi_b: any;
  pi_c: any;
  protocol: string;
  curve: any;
}

export function normalizePublicSignals(signals: bigint[]): bigint[] {
  for (let i = 0; i < signals.length; i++) {
    signals[i] = BigInt(signals[i]) % SNARK_SCALAR_FIELD;
  }
  return signals;
}
