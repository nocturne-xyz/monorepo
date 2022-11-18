import { keccak256 } from "ethers/lib/utils";
import { toUtf8Bytes } from "ethers/lib/utils";

export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const ERC20_ID = SNARK_SCALAR_FIELD - 1n;

export type Address = string;
export type AssetHash = string;

export interface AssetStruct {
  address: Address;
  id: bigint;
}

export function hashAsset(asset: AssetStruct): string {
  return keccak256(toUtf8Bytes(`${asset.address}:${asset.id.toString()}`));
}

export interface AssetRequest {
  asset: AssetStruct;
  value: bigint;
}
