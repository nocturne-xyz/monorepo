import { SNARK_SCALAR_FIELD } from "../commonTypes";

export function normalizeBigInt(n: bigint): bigint {
  return BigInt(n) % SNARK_SCALAR_FIELD;
}

export function normalizePublicSignals(signals: bigint[]): bigint[] {
  for (let i = 0; i < signals.length; i++) {
    signals[i] = normalizeBigInt(signals[i]);
  }
  return signals;
}
