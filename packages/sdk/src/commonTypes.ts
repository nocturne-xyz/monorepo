export type Address = string;

export interface FlattenedFlaxAddress {
  h1X: bigint;
  h1Y: bigint;
  h2X: bigint;
  h2Y: bigint;
}

export interface Asset {
  address: Address;
  id: bigint;
}
