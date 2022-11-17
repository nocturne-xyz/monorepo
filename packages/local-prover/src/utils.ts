import { keccak256 } from "ethers/lib/utils";
import { toUtf8Bytes } from "ethers/lib/utils";
import { AssetStruct, SNARK_SCALAR_FIELD } from "./common";

export function hashAsset(asset: AssetStruct): string {
  return keccak256(toUtf8Bytes(`${asset.address}:${asset.id.toString()}`));
}

export function normalizeBigInt(n: bigint): bigint {
  return BigInt(n) % SNARK_SCALAR_FIELD;
}

export function normalizePublicSignals(signals: bigint[]): bigint[] {
  for (let i = 0; i < signals.length; i++) {
    signals[i] = normalizeBigInt(signals[i]);
  }
  return signals;
}
