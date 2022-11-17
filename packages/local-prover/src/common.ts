export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const ERC20_ID = SNARK_SCALAR_FIELD - 1n;

export type Address = string;
export type AssetHash = string;

export interface AssetStruct {
  address: Address;
  id: bigint;
}

export interface AssetRequest {
  asset: AssetStruct;
  value: bigint;
}

export interface BaseProof {
  pi_a: any;
  pi_b: any;
  pi_c: any;
  protocol: string;
  curve: any;
}

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
