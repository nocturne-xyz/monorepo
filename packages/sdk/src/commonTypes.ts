export type Address = string;

export interface Asset {
  address: Address;
  id: bigint;
}

export interface AssetRequest extends Asset {
  value: bigint;
}
